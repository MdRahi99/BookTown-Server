const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const SSLCommerzPayment = require('sslcommerz-lts')
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASS
const is_live = false //true for live, false for sandbox

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nxhpsct.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const usersList = client.db('BookTown').collection('UsersList');
    const booksCategory = client.db('BookTown').collection('BooksCategory');
    const booksDetails = client.db('BookTown').collection('BooksDetails');
    const userAddedBooks = client.db('BookTown').collection('AddedBooks');
    const cartCollection = client.db('BookTown').collection('CartCollection');
    const paymentCollection = client.db("BookTown").collection("Payments");
    const contactDetails = client.db('BookTown').collection('ContactDetails');

    // /////////////// JWT ////////////////
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h'
      });
      res.send({ token });
    });
    // /////////////// JWT ////////////////

    // /////////////// Verify Admin ////////////////
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersList.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    };
    // /////////////// Verify Admin ////////////////

    // ...............Users............ //
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await usersList.find(query).toArray();
      res.send(result);
    });

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersList.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersList.insertOne(user);
      res.send(result);
    });

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }
      const query = { email: email };
      const user = await usersList.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    });

    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersList.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersList.deleteOne(query);
      res.send(result);
    });
    // ...............Users............ //

    // ...............Books............ //
    app.get('/books-category', async (req, res) => {
      const query = {};
      const cursor = booksCategory.find(query);
      const category = await cursor.toArray();
      res.send(category);
    });
    app.get('/books-category/:id', async (req, res) => {
      const id = req.params.id;
      const query = { '_id': new ObjectId(id) };
      const categoryDetails = await booksCategory.findOne(query);
      res.send(categoryDetails);
    });
    app.get('/books-details', async (req, res) => {
      const sort = req.query.sort;
      const search = String(req.query.search);
      const query = {
        name: { $regex: search, $options: 'i' }
      };
      // const query = {};
      // const query = {price: {$gt: 21, $lte: 30}};
      const options = {
        sort: {
          "price": sort === 'asc' ? 1 : -1
        }
      };
      const cursor = booksDetails.find(query, options);
      const books = await cursor.toArray();
      res.send(books);
    });
    app.get('/book-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { '_id': new ObjectId(id) };
      const bookDetails = await booksDetails.findOne(query);
      res.send(bookDetails);
    });

    app.get("/search", async (req, res) => {
      try {
        const query = req.query.name;
        const regexQuery = { $regex: new RegExp(query, "i") };
        const items = await booksDetails.find({ $or: [{ name: regexQuery }, { description: regexQuery }] }).toArray();
        res.json(items);
      } catch (error) {
        console.error("Error searching items:", error);
        res.status(500).json({ error: "Something went wrong" });
      }
    });
    // ...............Books............ //

    // ...............User Books............ //

    app.get("/my-books", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      if (decoded.email != req.query.email) {
        return res.status(403).send({ error: 1, message: 'forbidden access' })
      }
      let query = {};
      if (req.query?.email) {
        query = {
          email: req.query.email
        }
      }
      const cursor = userAddedBooks.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/my-book-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userAddedBooks.findOne(query);
      res.send(result);
    });

    app.post("/add-book", verifyJWT, async (req, res) => {
      const bookInfo = req.body;
      const info = await userAddedBooks.insertOne(bookInfo);
      res.send(info);
    });

    app.put("/update-book/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBook = req.body;
      const bookInfo = {
        $set: {
          email: updatedBook.email,
          img: updatedBook.img,
          name: updatedBook.name,
          author: updatedBook.author,
          rating: updatedBook.rating,
          price: updatedBook.price,
          desc: updatedBook.desc
        }
      };

      const result = await userAddedBooks.updateOne(filter, bookInfo, options);
      res.send(result);
    });

    app.delete("/delete-book/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userAddedBooks.deleteOne(query);
      res.send(result);
    });
    // ...............User Books............ //

    // ..............User Cart............ //
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([])
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.findOne(query);
      res.send(result);
    });

    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result)
    });

    app.delete("/delete-cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    app.post('/payment-info', verifyJWT, async (req, res) => {
      const order = req.body;
      const orderedService = await cartCollection.findOne({_id: new ObjectId(order.product)});
      const transactionId = new ObjectId().toString();

      const data = {
        total_amount: orderedService.price,
        currency: order.currency,
        tran_id: transactionId, // use unique tran_id for each api call
        success_url: `https://book-town-server-vo6a6ocu7-mdrahi99.vercel.app/payment/success?transactionId=${transactionId}`,
        fail_url: 'https://book-town-server-vo6a6ocu7-mdrahi99.vercel.app/payment/fail',
        cancel_url: 'https://book-town-server-vo6a6ocu7-mdrahi99.vercel.app/payment/cancel',
        ipn_url: 'https://book-town-server-vo6a6ocu7-mdrahi99.vercel.app/ipn',
        shipping_method: 'Courier',
        product_name: order.name,
        product_category: order.category,
        product_profile: 'general',
        cus_name: order.firstName,
        cus_email: order.email,
        cus_add1: order.address,
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: order.postcode,
        ship_country: 'Bangladesh',
      };
      
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
      sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL;
        paymentCollection.insertOne({
          ...order,
          price: orderedService.price,
          transactionId,
          paid: false
        })
        res.send({url: GatewayPageURL})
      });
    });

    app.post('/payment/success', async(req, res) => {
      console.log('Success');
      const {transactionId} = req.query;
      const result = await paymentCollection.updateOne({transactionId}, {$set: {paid:true, paidAt: new Date()}});
      if(result.modifiedCount > 0)
      res.redirect(`http://localhost:3000/payment/success?transactionId=${transactionId}`);
    });
    // ..............User Cart............ //

    // ...............Admin Books............ //
    app.post("/add-admin-book", verifyJWT, verifyAdmin, async (req, res) => {
      const bookInfo = req.body;
      const info = await booksDetails.insertOne(bookInfo);
      res.send(info);
    });

    app.put("/update-admin-book/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBook = req.body;
      const bookInfo = {
        $set: {
          email: updatedBook.email,
          img: updatedBook.img,
          name: updatedBook.name,
          author: updatedBook.author,
          rating: updatedBook.rating,
          price: updatedBook.price,
          desc: updatedBook.desc
        }
      };

      const result = await booksDetails.updateOne(filter, bookInfo, options);
      res.send(result);
    });

    app.delete("/delete-admin-book/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksDetails.deleteOne(query);
      res.send(result);
    });
    // ...............Admin Books............ //

    app.post("/contact-info", async (req, res) => {
      const info = req.body;
      const details = await contactDetails.insertOne(info);
      res.send(details);
    });
  }
  finally { }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('BookTown Server Running...');
});

app.listen(port, () => {
  console.log(`BookTown Server Running On Port: ${port}`);
});