const express=require("express");
const {MongoClient}=require("mongodb");
const path = require('path');
const multer = require('multer');
const app=express();

app.set("view engine","ejs");
app.use(express.urlencoded({extended:true}));


const url="mongodb+srv://admin:root@cluster0.8prkxvt.mongodb.net/?retryWrites=true&w=majority";

// const url="mongodb://127.0.0.1:27017";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });
  
  const upload = multer({ storage: storage });

async function getcollection(){
    try{
    const client=new MongoClient(url);
    client.connect();
    return client.db('knowyourcar').collection('cars');
    }catch(err){
        console.error(err);
    }
}   

app.get("/insert",(req,res)=>{
    res.render("index");
});

app.post("/insert", upload.single('image'),async (req,res)=>{
    const imageUrl = req.file.path;
const {name,brand,year,price,rating,fuel,engine,power,drivetrain,acceleration,seating}=req.body;

    let car={
        name: name,
        brand: brand,
        year: parseInt(year),
        price: parseFloat(price),
        rating:parseFloat(rating),
        specificatios:{
            fuel:fuel,
            engine:engine,
            power:power,
            drivetrain:drivetrain,
            acceleration:acceleration,
            seating:seating,
        },
        image:imageUrl,
        };
    try{
    let collection=await getcollection();
    let result=await collection.insertOne(car);
    res.redirect('/');
    }catch(err){
        console.error(err);
    }
    }
);

app.get('/', async (req,res)=>{
    try{
        var collection=await getcollection();
        var data=await collection.find({}).toArray();
        console.log(data);
        res.json(data);
    }catch(err){
        console.error(err);
    }
})

app.listen(8000,()=>{
    console.log("Listening at localhost:8000");
})