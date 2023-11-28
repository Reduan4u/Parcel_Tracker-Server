const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { Schema, model } = require('mongoose');
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
        //await client.connect();

        const deliveryManCollection = client.db("parcelTracker").collection("deliveryMan");
        const parcelCollection = client.db("parcelTracker").collection("parcels");
        const userCollection = client.db("parcelTracker").collection("users");

        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // middlewares 
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'Admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }
        // use verify delivery man after verifyToken
        const verifyDeliveryMen = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isDeliveryMen = user?.role === 'DeliveryMen';
            if (!isDeliveryMen) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }

        // users related api
        app.get('/users', verifyToken, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });


        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'Admin';
            }
            res.send({ admin });
        });

        app.get('/users/deliveryMen/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let deliveryMen = false;
            if (user) {
                deliveryMen = user?.role === 'DeliveryMen';
            }
            res.send({ deliveryMen });
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists: 
            // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        //Make Delivery Men
        app.patch('/users/deliveryMen/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'DeliveryMen'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })
        // Make Admin
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })



        // GET request to check if a user with the provided email already exists
        app.get('/user/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const existingUser = await userCollection.findOne({ email });

                res.json({ exists: !!existingUser });
            } catch (error) {
                console.error('Error checking if user exists:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // GET request to retrieve delivery men
        app.get('/deliveryMan', async (req, res) => {
            const result = await deliveryManCollection.find().toArray();
            res.send(result);

        })


        /* __________________________________________________________________________________________ */


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

        // GET request to retrieve parcel
        app.get('/parcel', async (req, res) => {
            try {
                const email = req.query.email;
                let query = {};

                if (email) {
                    // If email is provided, filter by senderEmail
                    query.senderEmail = email;
                }

                const fromDate = req.query.fromDate;
                const toDate = req.query.toDate;

                const result = await parcelCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                console.error('Error fetching parcels:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });



        app.patch('/parcel/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    bookingStatus: 'Cancel'
                }
            }
            const result = await parcelCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })



        //Make parcel cancel 
        // Make parcel cancel 
        app.patch('/parcel/cancel/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };
                const updatedDoc = {
                    $set: {
                        bookingStatus: 'Cancelled'
                    }
                }
                const result = await parcelCollection.updateOne(filter, updatedDoc);

                if (result.modifiedCount > 0) {
                    res.status(200).json({ message: 'Parcel cancelled successfully' });
                } else {
                    res.status(404).json({ message: 'Parcel not found' });
                }
            } catch (error) {
                console.error('Error cancelling parcel:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });
        // Update parcel (for other updates, if needed)
        app.patch('/parcel/update/:id', async (req, res) => {
            try {
                // Your logic for updating a parcel (if needed)
            } catch (error) {
                console.error('Error updating parcel:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // Single Food read
        app.get('/parcel/:parcelId', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await parcelCollection.findOne(query);
            res.send(result);
        })

        // GET request to retrieve bookings by date for Statistics
        app.get('/bookingsByDate', async (req, res) => {
            try {
                const result = await parcelCollection.aggregate([
                    {
                        $group: {
                            _id: {
                                year: { $year: { $toDate: '$deliveryDate' } },
                                month: { $month: { $toDate: '$deliveryDate' } },
                                day: { $dayOfMonth: { $toDate: '$deliveryDate' } },
                            },
                            bookings: { $sum: 1 },
                        },
                    },
                    {
                        $sort: {
                            '_id.year': 1,
                            '_id.month': 1,
                            '_id.day': 1,
                        },
                    },
                ]).toArray();

                res.json(result);
            } catch (error) {
                console.error('Error fetching bookings by date:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        /* // PUT request to manage a parcel
        app.put('/manageParcel/:parcelId', async (req, res) => {
            const parcelId = req.params.parcelId;
            const { deliveryManId, approximateDeliveryDate, deliveryMenEmail } = req.body;

            try {
                // Fetch the delivery man's email
                const deliveryMan = await userCollection.findOne({ _id: new ObjectId(deliveryManId) });
                const deliveryManEmail = deliveryMan ? deliveryMan.email : '';

                // Format the date
                const formattedDate = new Date(approximateDeliveryDate).toISOString().split('T')[0];

                // Update the parcel in the database
                const result = await parcelCollection.updateOne(
                    { _id: new ObjectId(parcelId) },
                    {
                        $set: {
                            bookingStatus: 'On The Way',
                            deliveryMenId: deliveryManId,
                            approximateDeliveryDate: formattedDate,
                        },
                    }
                );

                res.json({ modifiedCount: result.modifiedCount });
            } catch (error) {
                console.error('Error managing parcel:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        }); */

        // PUT request to manage a parcel
        app.put('/manageParcel/:parcelId', async (req, res) => {
            const parcelId = req.params.parcelId;
            const { deliveryManId, approximateDeliveryDate, deliveryMenEmail } = req.body;

            try {
                // Fetch the delivery man's email
                const deliveryMan = await userCollection.findOne({ _id: new ObjectId(deliveryManId) });
                const deliveryManEmail = deliveryMan ? deliveryMan.email : '';
                // Format the date
                const formattedDate = new Date(approximateDeliveryDate).toISOString().split('T')[0];

                // Update the parcel in the database
                const result = await parcelCollection.updateOne(
                    { _id: new ObjectId(parcelId) },
                    {
                        $set: {
                            bookingStatus: 'On The Way',
                            deliveryMenId: deliveryManId,
                            approximateDeliveryDate: formattedDate,
                            deliveryMenEmail: deliveryManEmail
                        },
                    }
                );

                res.json({ modifiedCount: result.modifiedCount });
            } catch (error) {
                console.error('Error managing parcel:', error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });


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
