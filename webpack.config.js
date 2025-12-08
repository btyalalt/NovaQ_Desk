const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/webpack-entry.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: false,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              ['@babel/preset-react', { runtime: 'automatic' }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name][ext]'
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    fallback: {
      "buffer": require.resolve("buffer"),
      "util": require.resolve("util"),
      "stream": require.resolve("stream-browserify"),
      "crypto": require.resolve("crypto-browserify"),
      "process": require.resolve("process/browser"),
      "https": false,
      "http": false
    }
  },
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    minimizer: process.env.NODE_ENV === 'production' ? [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // Production-д console.log-уудыг арилгах
            drop_debugger: true,
          },
        },
      }),
    ] : [],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html',
      inject: false
    }),
    new webpack.DefinePlugin({
      'process.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION || require('./package.json').version)
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/preload.js', to: 'preload.js' },
        { from: 'assets/favicon.svg', to: 'favicon.svg' },
        { from: 'assets/icon.ico', to: 'favicon.ico' },
        { from: 'assets/icon.ico', to: 'assets/icon.ico' },
        { from: 'assets/Logopng.png', to: 'assets/Logopng.png' }
      ]
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 3201,
    hot: true,
    open: false,
    historyApiFallback: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  }
};
