// Required dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/vexora', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Schema definitions
const Episode = mongoose.model('Episode', {
  title: String,
  airDate: Date,
  episodeNumber: Number,
  series: String
});

const Poll = mongoose.model('Poll', {
  question: String,
  options: [{
    text: String,
    votes: {
      type: Number,
      default: 0
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date
});

// API Routes

// Get next episode information
app.get('/api/next-episode', async (req, res) => {
  try {
    const nextEpisode = await Episode.findOne({
      airDate: { $gt: new Date() }
    }).sort({ airDate: 1 });
    
    res.json(nextEpisode);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch next episode' });
  }
});

// Create new episode
app.post('/api/episodes', async (req, res) => {
  try {
    const episode = new Episode(req.body);
    await episode.save();
    res.status(201).json(episode);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create episode' });
  }
});

// Get current poll
app.get('/api/polls/current', async (req, res) => {
  try {
    const currentPoll = await Poll.findOne({
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
    
    res.json(currentPoll);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current poll' });
  }
});

// Vote on poll
app.post('/api/polls/:pollId/vote', async (req, res) => {
  try {
    const { pollId } = req.params;
    const { optionIndex } = req.body;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Increment vote count for selected option
    poll.options[optionIndex].votes += 1;
    await poll.save();

    res.json(poll);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register vote' });
  }
});

// Create new poll
app.post('/api/polls', async (req, res) => {
  try {
    const poll = new Poll(req.body);
    await poll.save();
    res.status(201).json(poll);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Schedule automated tasks
cron.schedule('0 0 * * *', async () => {
  try {
    // Clean up expired polls
    await Poll.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    // Create next episode's poll if needed
    const nextEpisode = await Episode.findOne({
      airDate: { $gt: new Date() }
    }).sort({ airDate: 1 });

    if (nextEpisode) {
      const newPoll = new Poll({
        question: `Will servers break for ${nextEpisode.title} Episode ${nextEpisode.episodeNumber}?`,
        options: [
          { text: '100% Possible', votes: 0 },
          { text: 'Not Possible', votes: 0 }
        ],
        expiresAt: nextEpisode.airDate
      });
      await newPoll.save();
    }
  } catch (error) {
    console.error('Scheduled task failed:', error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
