const functions = require("firebase-functions/v1");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const express = require("express");
const cors = require("cors");

const logger = functions.logger;

initializeApp();

const app = express();

// Allow larger bodies so base64-encoded recipe images can be uploaded.
app.use(express.json({ limit: "10mb" }));

// Apply the CORS middleware to both app and dev
app.use(cors({ origin: true }));

const db = getFirestore();

const STORAGE_BUCKET = "recipe-rack-ighp8.firebasestorage.app";

module.exports = { app, functions, logger, db, Timestamp, STORAGE_BUCKET };