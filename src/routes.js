const express = require("express");
const { identifyHandler } = require("./controller");

const router = express.Router();

router.post("/identify", identifyHandler);

module.exports = router;