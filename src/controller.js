const { identifyContact } = require("./service");

async function identifyHandler(req, res) {
  try {
    const { email, phoneNumber } = req.body;

    const result = await identifyContact(email, phoneNumber);

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

module.exports = { identifyHandler };