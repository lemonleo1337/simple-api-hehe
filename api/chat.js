const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// CORS and OPTIONS handling middleware
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS, POST");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // If it's an OPTIONS request, respond with allowed methods and an empty body
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

    // Check for stream mode
    const isStream = data.stream === true;

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
        // Send request to the external API with dynamic deployment ID
        const response = await axios.post(
            `https://dashboard.scale.com/spellbook/api/v2/deploy/${process.env.ID}`,
            externalData,
            {
                headers: {
                    Authorization: `Basic ${process.env.KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // Extract the "output" from the external API response
        const assistantContent = response.data.output || "No output from external API";

        // If streaming is enabled, respond with data in chunks
        if (isStream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Split the assistant content into chunks of two words each
            const words = assistantContent.split(" ");
            let chunk = "";
            for (let i = 0; i < words.length; i++) {
                chunk += words[i] + " ";
                if ((i + 1) % 2 === 0 || i === words.length - 1) {
                    res.write(`data: ${JSON.stringify({
                        candidates: [
                            {
                                content: {
                                    parts: [{ text: chunk.trim() }]
                                },
                                role: "model"
                            }
                        ]
                    })}\n\n`);
                    chunk = ""; // Reset chunk for the next set of words
                    await new Promise(resolve => setTimeout(resolve, 200)); // Simulated delay
                }
            }

            // Signal the end of the stream
            res.write("data: [DONE]\n\n");
            res.end();
        } else {
            // If not in stream mode, return the response in JSON format as usual
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
            res.json(responseData);
        }

    } catch (error) {
        res.status(500).json({ error: "Failed to connect to external API", details: error.message });
    }
});

module.exports = app;
