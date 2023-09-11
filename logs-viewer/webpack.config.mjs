import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import CopyPlugin from "copy-webpack-plugin"

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// noinspection JSUnusedGlobalSymbols
export default {
  entry: ['./src/ui/index.tsx'],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      }
    ],
  },
  externals:{
    'react': "React",
    "axios": "axios",
    'react-dom/client': "ReactDOM"
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'bundle.js',
    library: {
      name: "MyLib",
      type: "var"
    },
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "./src/index.html"}
      ],
    }),
  ]
};