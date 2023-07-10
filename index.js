const express = require('express');
const cors = require('cors');
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

async function run() {
  try {
    const booksCategory = client.db('BookTown').collection('BooksCategory');
    const booksDetails = client.db('BookTown').collection('BooksDetails');

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
    app.get('/books-details/:id', async (req, res) => {
      const id = req.params.id;
      const query = { '_id': new ObjectId(id) };
      const bookDetails = await booksDetails.findOne(query);
      res.send(bookDetails);
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