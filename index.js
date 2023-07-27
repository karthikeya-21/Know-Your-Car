const express=require("express");
const {MongoClient,Binary}=require("mongodb");
const multer = require('multer');
const app=express();

app.set("view engine","ejs");
app.use(express.urlencoded({extended:true}));
const upload = multer();

const url="mongodb+srv://admin:root@cluster0.8prkxvt.mongodb.net/?retryWrites=true&w=majority";

// const url="mongodb://127.0.0.1:27017";

async function getcollection(){
    try{
    const client=new MongoClient(url,{ useUnifiedTopology: true });
    client.connect();
    return client.db('knowyourcar').collection('cars');
    }catch(err){
        console.error(err);
    }
}   
async function getbrandcollection(){
    try{
    const client=new MongoClient(url,{ useUnifiedTopology: true });
    client.connect();
    return client.db('knowyourcar').collection('brands');
    }catch(err){
        console.error(err);
    }
}   

app.get("/insert",(req,res)=>{
    res.render("index");
});

app.post("/insert", upload.single('image'),async (req,res)=>{
    // const imageFile = req.file.buffer;
    const {name,brand,year,price,rating,fuel,engine,power,drivetrain,acceleration,seating,image}=req.body;

    let car={
        name: name,
        brand: brand,
        year: year,
        price: price,
        rating:rating,
        specificatios:{
            fuel:fuel,
            engine:engine,
            power:power,
            drivetrain:drivetrain,
            acceleration:acceleration,
            seating:seating,
        },
        // image:new Binary(imageFile),
        Image:image,
        };
    try{
    let collection=await getcollection();
    let result=await collection.insertOne(car);
    res.redirect('/insert');
    }catch(err){
        console.error(err);
    }
    }
);

app.get('/', async (req,res)=>{
    try{
        var collection=await getcollection();
        var data=await collection.find({}).toArray();
        // console.log(data);
        res.json(data);
    }catch(err){
        console.error(err);
    }
});

app.get('/update/:name',async (req,res)=>{
    let collection=await getcollection();
    var data=await collection.findOne({name:req.params.name});
    // console.log(data);
    if(data.length==0){
        res.end("No data found with this name;")
    }
    res.render("update",{data:data});
});


app.get('/name/:name',async (req,res)=>{
    let collection=await getcollection();
    const name = req.params.name;
        // Use a regular expression to perform a partial match on the name
    const regex = new RegExp(name, 'i');
    let data=await collection.find({name:regex}).toArray();
    console.log(data);
    // if(data.length==0){
    //     res.end("Data not found with the given Name");
    // }
    res.json(data);
});

app.get('/brand/:brand',async(req,res)=>{

    let collection=await getcollection();
    // console.log(req.params.brand);
    let data=await collection.find({brand:req.params.brand}).toArray();
    // console.log(data);
    // if(data.length==0){
    //     res.end();
    // }
    // else{
        res.send(data);
    // }
    res.end();
});

app.get('/brand',(req,res)=>{
    res.render("brand");
});

app.use(express.urlencoded({extended:true}));
app.post("/insertbrand",async (req,res)=>{
    const {brand,logo}=req.body;
    console.log(req.body);
    let newbrand={
        brand: brand,
        logo:logo,
    }
    try{
        let collection=await getbrandcollection();
        let result=await collection.insertOne(newbrand);
        if(result){
            res.redirect('/brand');
        }

    }catch(err){
        res.end(err);
    }
});

app.get('/getbrands', async (req,res)=>{
    try{
        let collection=await getbrandcollection();
        let result=await collection.find({}).toArray();
        return res.json(result);
    }catch(err){
        console.log(err);
    }
});











const port=8000;

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
