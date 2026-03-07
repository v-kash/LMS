const bcrypt = require("bcryptjs");

// Simple version using .then()
bcrypt.hash("Welcome@123", 10)
  .then(hash1 => {
    console.log("Hash 1:", hash1);
    return bcrypt.hash("Welcome@123", 10);
  })
  .then(hash2 => {
    console.log("Hash 2:", hash2);
    return bcrypt.compare("Welcome@123", hash1);
  })
  .then(isValid => {
    console.log("Password verification:", isValid);
  })
  .catch(err => {
    console.error("Error:", err);
  });