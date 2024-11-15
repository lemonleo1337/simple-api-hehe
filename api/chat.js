const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS, POST");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // If it's an OPTIONS request, respond with the allowed methods and an empty body
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    next();
});

app.post('/v1/chat/completions', async (req, res) => {
    // Authorization Check
    const authHeader = req.headers.authorization;
    const expectedToken = `Bearer ${process.env.PASS}`;
    if (!authHeader || authHeader !== expectedToken) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    // Check if required fields are present
    const data = req.body;
    if (!data || !data.messages) {
        return res.status(400).json({ error: "Invalid request, 'messages' field is required" });
    }

    // Convert 'messages' array to JSON string format
    const messagesList = data.messages;
    const messagesStr = JSON.stringify(messagesList);

    // Prepare data for the external API request
    const externalData = {
        input: {
            input: messagesStr
        }
    };

    try {
        // Send request to the external API
        const response = await axios.post(
            `https://dashboard.scale.com/spellbook/api/v2/deploy/${process.env.ID}`,
            externalData,
            {
                headers: {
                    'Authorization': `Basic ${process.env.KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract the "output" from the external API response
        const assistantContent = response.data.output || "No output from external API";

        // Constructing a response similar to OpenAI's API format
        const responseData = {
            id: "mock-response-123",
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "gpt-4-turbo",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: assistantContent
                    },
                    finish_reason: "stop"
                }
            ]
        };

        // Return the response in JSON format
        res.json(responseData);

    } catch (error) {
        res.status(500).json({ error: "Failed to connect to external API", details: error.message });
    }
});

module.exports = app;
