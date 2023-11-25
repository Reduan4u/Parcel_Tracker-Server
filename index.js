const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mt6zv6m.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const deliveryManCollection = client.db("parcelTracker").collection("deliveryMan");
        const parcelCollection = client.db("parcelTracker").collection("parcels");

        // GET request to retrieve delivery men
        app.get('/deliveryMan', async (req, res) => {
            const result = await deliveryManCollection.find().toArray();
            res.send(result);

        })

        // POST request to book a parcel
        app.post('/parcel', async (req, res) => {
            const newParcel = req.body;
            try {
                const result = await parcelCollection.insertOne(newParcel);
                res.json({ insertedId: result.insertedId });
            } catch (error) {
                console.error('Error booking parcel:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
        // GET request to retrieve delivery men
        app.get('/parcel', async (req, res) => {
            const result = await parcelCollection.find().toArray();
            res.send(result);

        })




        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Parcel is on the way')
})

app.listen(port, () => {
    console.log(`Parcel is on the port ${port}`);
})
