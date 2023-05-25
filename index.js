const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send('BookTown Server Running...');
});

app.listen(port, () => {
    console.log(`BookTown Server Running On Port: ${port}`);
});