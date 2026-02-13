const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Item = require('../models/Item');
const Transaction = require('../models/Transaction');
const Request = require('../models/Request');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    const txResult = await Transaction.deleteMany({});
    console.log(`Deleted ${txResult.deletedCount} transactions`);

    const reqResult = await Request.deleteMany({});
    console.log(`Deleted ${reqResult.deletedCount} requests`);

    const itemResult = await Item.deleteMany({});
    console.log(`Deleted ${itemResult.deletedCount} items`);

    await mongoose.connection.close();
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

run();
