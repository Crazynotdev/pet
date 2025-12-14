const express = require('express');
const { startPair } = require('./pair');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/connect', async (req, res) => {
    const { number, mode } = req.body;
    const code = await startPair(number, mode);
    res.json({ code });
});
app.listen(3000, () => { 
    console.log('Server running on http://localhost:3000');
});