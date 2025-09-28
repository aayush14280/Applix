const path = require('path');

module.exports = {
  // Set mode to 'development' for easier debugging, or 'production' for smaller files
  mode: 'development', 

  entry: {
    // The key 'popup' will create 'popup.bundle.js'
    popup: './src/main.js', 
    
    // The key 'background' will create 'background.bundle.js'
    background: './background/background.js'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
};