const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const multer = require('multer');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

const apiKey = 'K2kJE1o8Vvh4r9qenLys8MJLEKKXQLJa';
const upload = multer({ dest: 'uploads/' });

// Function to create a chat session
async function createChatSession(apiKey, externalUserId) {
  const response = await fetch('https://api.on-demand.io/chat/v1/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify({
      pluginIds: [],
      externalUserId: externalUserId
    })
  });

  const data = await response.json();
  return data.data.id; // Extract session ID
}

// Function to submit a query using the session ID
async function submitQuery(apiKey, sessionId, query) {
  const response = await fetch(`https://api.on-demand.io/chat/v1/sessions/${sessionId}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify({
      endpointId: 'predefined-openai-gpt4o',
      query: query,
      pluginIds: [
        'plugin-1712327325',
        'plugin-1713962163',
        'plugin-1716119225',
        'plugin-1716334779'
      ],
      responseMode: 'sync'
    })
  });

  // Check if the response is valid JSON
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error: ${errorText}`);
  }

  const data = await response.json();
  return data;
}

let sessionId = null;

app.post('/api/chat', async (req, res) => {
  const externalUserId = 'user123';
  const { message } = req.body;

  try {
    if (!sessionId) {
      sessionId = await createChatSession(apiKey, externalUserId);
    }
    const response = await submitQuery(apiKey, sessionId, message);
    
    // Modify the response to match the desired format
    res.json({
      message: "Chat query submitted successfully",
      data: {
        sessionId: sessionId,
        messageId: response.data?.messageId || null,
        answer: response.data?.answer || "I'm unable to see or describe images. Please provide a description or context for the image, and I'll do my best to assist you with any information or questions related to it.",
        metrics: response.data?.metrics || {},
        status: response.data?.status || "completed"
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message || 'An error occurred' });
  }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  try {
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');

    const response = await fetch('https://api.on-demand.io/chat/v1/image-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        image: base64Image,
        endpointId: 'predefined-openai-gpt4v'
      })
    });

    const data = await response.json();
    console.log('OnDemand API Response:', data); // Log the entire response for debugging
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    // Ensure we're sending a consistent response format
    res.json({
      data: {
        response: data.data?.response || data.data?.analysis || 'Image analysis completed successfully.',
      }
    });
  } catch (error) {
    console.error('Error analyzing image:', error);
    res.status(500).json({ error: 'An error occurred while analyzing the image' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
