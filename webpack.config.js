const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const isDevelopment = process.env.NODE_ENV !== 'production';
const apiBaseUrlDev = process.env.API_BASE_URL_DEV || 'http://localhost:3119';
const apiBaseUrl = process.env.API_BASE_URL || 'https://novaq.mn:3119';
const apiWsBaseUrlDev = apiBaseUrlDev.replace(/^http/, 'ws');
const apiWsBaseUrl = apiBaseUrl.replace(/^http/, 'ws');
const cspContent = [
  "default-src 'self';",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''};`,
  "style-src 'self' 'unsafe-inline';",
  "img-src 'self' data: https:;",
  `connect-src 'self'${isDevelopment ? ' http://localhost:3201 ws://localhost:3201' : ''} ${apiBaseUrlDev} ${apiBaseUrl} ${apiWsBaseUrlDev} ${apiWsBaseUrl} https://desktop-f96376.gitlab.io/ https://api.ipify.org;`
].join(' ');

module.exports = {
  mode: isDevelopment ? 'development' : 'production',
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
      inject: false,
      templateParameters: {
        cspContent,
      },
    }),
    new webpack.DefinePlugin({
      'process.env.APP_VERSION': JSON.stringify(process.env.APP_VERSION || require('./package.json').version),
      'process.env.API_BASE_URL_DEV': JSON.stringify(process.env.API_BASE_URL_DEV || 'http://localhost:3119'),
      'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || 'https://novaq.mn:3119')
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
