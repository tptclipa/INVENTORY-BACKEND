const mongoose = require('mongoose');
const Request = require('../models/Request');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cleanupRequests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // Find all requests with items array but no proper data
    const problematicRequests = await Request.find({
      $or: [
        { items: { $exists: true, $ne: [] }, item: null, quantity: null },
        { items: { $elemMatch: { quantity: null } } },
        { items: { $elemMatch: { unit: null } } }
      ]
    });

    console.log(`Found ${problematicRequests.length} problematic requests:`);
    problematicRequests.forEach(req => {
      console.log(`- ID: ${req._id}, Items: ${req.items?.length || 0}, Status: ${req.status}`);
    });

    if (problematicRequests.length > 0) {
      console.log('\nDeleting problematic requests...');
      const result = await Request.deleteMany({
        _id: { $in: problematicRequests.map(r => r._id) }
      });
      console.log(`✅ Deleted ${result.deletedCount} requests`);
    } else {
      console.log('✅ No problematic requests found!');
    }

    await mongoose.connection.close();
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

cleanupRequests();
