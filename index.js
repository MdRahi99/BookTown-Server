const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require("dotenv").config();

app.use(cors());
app.use(express.json());

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
  if(!authorization){
    return res.status(401).send({error: true, message: 'unauthorized access'})
  }

  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if(error){
      return res.status(401).send({error: true, message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const booksCategory = client.db('BookTown').collection('BooksCategory');
    const booksDetails = client.db('BookTown').collection('BooksDetails');
    const userAddedBooks = client.db('BookTown').collection('AddedBooks');
    const contactDetails = client.db('BookTown').collection('ContactDetails');

    // /////////////// JWT ////////////////
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: 10
      });
      res.send({token});
    });
    // /////////////// JWT ////////////////
    
    
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
      const query = {};
      const cursor = booksDetails.find(query);
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

// .................................... //

    app.get("/my-books", verifyJWT, async (req, res) => {
      const decoded = req.decoded;
      if(decoded.email != req.query.email){
        return res.status(403).send({error: 1, message: 'forbidden access'})
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

    app.get("/my-book-details/:id", async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await userAddedBooks.findOne(query);
      res.send(result);
    });

    app.post("/add-book", async (req, res) => {
      const bookInfo = req.body;
      const info = await userAddedBooks.insertOne(bookInfo);
      res.send(info);
    });

    app.delete("/delete-book/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userAddedBooks.deleteOne(query);
      res.send(result);
    });

// .................................... //

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