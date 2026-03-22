require('dotenv').config();
const express = require("express");
const { MongoClient } = require("mongodb");
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

// Multer — store in memory so we can stream to Cloudinary
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

/**
 * Upload a buffer to Cloudinary with background removal.
 * @param {Buffer} buffer   - image buffer from multer
 * @param {string} folder   - 'cars' or 'brands'
 * @param {string} publicId - slugified filename
 * @returns {Promise<string>} secure_url of the uploaded image
 */
function uploadToCloudinary(buffer, folder, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                public_id: publicId,
                overwrite: false,
                background_removal: 'cloudinary_ai', // built-in AI BG removal
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        // Pipe buffer into the upload stream
        const readable = new Readable();
        readable.push(buffer);
        readable.push(null);
        readable.pipe(uploadStream);
    });
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
        const imageUrl = await uploadToCloudinary(
            req.file.buffer,
            'cars',
            name.replace(/\s+/g, '_').toLowerCase()
        );

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

        // Only re-upload if a new image was provided
        if (req.file) {
            updatedCar.image = await uploadToCloudinary(
                req.file.buffer,
                'cars',
                name.replace(/\s+/g, '_').toLowerCase()
            );
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
        const logoUrl = await uploadToCloudinary(
            req.file.buffer,
            'brands',
            brand.replace(/\s+/g, '_').toLowerCase()
        );

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
