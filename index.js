require('dotenv').config();
const express = require("express");
const { MongoClient } = require("mongodb");
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

// Multer — memory storage so we can stream to Cloudinary
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed.'));
        }
        cb(null, true);
    }
});

// Cloudinary config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB
const url = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
let db;

async function connectDB() {
    try {
        const client = new MongoClient(url);
        await client.connect();
        db = client.db('knowyourcar');
        console.log("Connected to MongoDB");
    } catch (err) {
        console.error("Failed to connect to MongoDB:", err);
        process.exit(1);
    }
}

function getCollection(name) {
    return db.collection(name);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Upload a buffer to Cloudinary with background_removal enabled.
 * Returns the public_id and initial secure_url.
 */
function uploadToCloudinary(buffer, folder, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: publicId,
                overwrite: true,
                background_removal: 'cloudinary_ai',
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream);
    });
}

/**
 * Poll Cloudinary every 2s until background_removal is 'complete'.
 * Resolves with the final secure_url (PNG with transparent BG).
 * Rejects if it times out after `timeoutMs` milliseconds.
 */
function waitForBgRemoval(publicId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const interval = 2000; // poll every 2s
        const deadline = Date.now() + timeoutMs;

        const poll = async () => {
            if (Date.now() > deadline) {
                return reject(new Error('Background removal timed out after 30s.'));
            }

            try {
                // Fetch the resource info including background_removal status
                const resource = await cloudinary.api.resource(publicId, {
                    quality_analysis: false,
                    image_metadata: false,
                });

                const bgStatus = resource?.info?.background_removal?.cloudinary_ai?.status;
                console.log(`[BG Removal] ${publicId} → status: ${bgStatus}`);

                if (bgStatus === 'complete') {
                    // Build the final URL — Cloudinary stores the result as a PNG
                    const finalUrl = cloudinary.url(publicId, {
                        secure: true,
                        format: 'png',
                    });
                    return resolve(finalUrl);
                } else if (bgStatus === 'failed') {
                    // BG removal failed — fall back to original image URL
                    console.warn(`[BG Removal] Failed for ${publicId}, using original.`);
                    return resolve(resource.secure_url);
                }

                // Still pending — wait and try again
                setTimeout(poll, interval);
            } catch (err) {
                reject(err);
            }
        };

        // Start first poll after a short initial delay
        setTimeout(poll, interval);
    });
}

/**
 * Full flow: upload → wait for BG removal → return final URL.
 */
async function uploadWithBgRemoval(buffer, folder, slug) {
    const result = await uploadToCloudinary(buffer, folder, slug);
    console.log(`[Cloudinary] Uploaded: ${result.public_id}`);
    const finalUrl = await waitForBgRemoval(result.public_id);
    console.log(`[Cloudinary] BG removed: ${finalUrl}`);
    return finalUrl;
}

// ─── Routes ────────────────────────────────────────────────────────────────────

app.get("/insert", (req, res) => res.render("index"));

app.post("/insert", upload.single('image'), async (req, res) => {
    const { name, brand, year, price, rating, fuel, engine, power, drivetrain, acceleration, seating } = req.body;

    if (!name || !brand || !year || !price || !rating || !fuel || !engine || !power || !drivetrain || !acceleration || !seating) {
        return res.status(400).send("All fields are required.");
    }
    if (!req.file) {
        return res.status(400).send("Car image is required.");
    }

    try {
        const slug = name.replace(/\s+/g, '_').toLowerCase();
        const imageUrl = await uploadWithBgRemoval(req.file.buffer, 'cars', slug);

        await getCollection('cars').insertOne({
            name, brand, year, price, rating,
            specifications: { fuel, engine, power, drivetrain, acceleration, seating },
            image: imageUrl,
        });

        res.redirect('/insert');
    } catch (err) {
        console.error("Insert error:", err);
        res.status(500).send("Failed to insert car: " + err.message);
    }
});

app.get('/', async (req, res) => {
    try {
        const data = await getCollection('cars').find({}).toArray();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to fetch cars.");
    }
});

app.get('/update/:name', async (req, res) => {
    try {
        const data = await getCollection('cars').findOne({ name: req.params.name });
        if (!data) return res.status(404).send("No car found with this name.");
        res.render("update", { data });
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to fetch car.");
    }
});

app.post('/update/:name', upload.single('image'), async (req, res) => {
    const { name, brand, year, price, rating, fuel, engine, power, drivetrain, acceleration, seating } = req.body;

    try {
        const updatedCar = {
            name, brand, year, price, rating,
            specifications: { fuel, engine, power, drivetrain, acceleration, seating },
        };

        if (req.file) {
            const slug = name.replace(/\s+/g, '_').toLowerCase();
            updatedCar.image = await uploadWithBgRemoval(req.file.buffer, 'cars', slug);
        }

        await getCollection('cars').updateOne(
            { name: req.params.name },
            { $set: updatedCar }
        );
        res.redirect('/');
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).send("Failed to update car: " + err.message);
    }
});

app.get('/name/:name', async (req, res) => {
    try {
        const regex = new RegExp(req.params.name, 'i');
        const data = await getCollection('cars').find({ name: regex }).toArray();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to search cars.");
    }
});

app.get('/brand/:brand', async (req, res) => {
    try {
        const data = await getCollection('cars').find({ brand: req.params.brand }).toArray();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to fetch brand cars.");
    }
});

app.get('/brand', (req, res) => res.render("brand"));

app.post("/insertbrand", upload.single('logo'), async (req, res) => {
    const { brand } = req.body;

    if (!brand) return res.status(400).send("Brand name is required.");
    if (!req.file) return res.status(400).send("Brand logo is required.");

    try {
        const slug = brand.replace(/\s+/g, '_').toLowerCase();
        const logoUrl = await uploadWithBgRemoval(req.file.buffer, 'brands', slug);

        await getCollection('brands').insertOne({ brand, logo: logoUrl });
        res.redirect('/brand');
    } catch (err) {
        console.error("Brand insert error:", err);
        res.status(500).send("Failed to insert brand: " + err.message);
    }
});

app.get('/getbrands', async (req, res) => {
    try {
        const result = await getCollection('brands').find({}).toArray();
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to fetch brands.");
    }
});

app.get('/about_us', async (req, res) => {
    try {
        const aboutdata = await getCollection('about').find({}).toArray();
        res.json(aboutdata);
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to fetch about data.");
    }
});

// ─── Start ──────────────────────────────────────────────────────────────────────

const port = process.env.PORT || 8000;

connectDB().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
});