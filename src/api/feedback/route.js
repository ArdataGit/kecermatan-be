const express = require('express');
const router = express.Router();
const {
  insertFeedback,
  updateFeedback,
  removeFeedback,
  getFeedbacks,
  insertFeedbackSetting,
  updateFeedbackSetting,
  getFeedbackSettings,
  checkUserFeedback,
  removeFeedbackSetting,
} = require('./controller');

// Feedback routes
router.get('/feedbacks', getFeedbacks);
router.get('/feedbacksUser', checkUserFeedback);
router.post('/feedbacks', insertFeedback);
router.patch('/feedbacks/:id', updateFeedback);
router.delete('/feedbacks/:id', removeFeedback);

// Feedback setting routes
router.get('/feedback-settings', getFeedbackSettings);
router.post('/feedback-settings', insertFeedbackSetting);
router.patch('/feedback-settings', updateFeedbackSetting);
router.delete('/feedback-settings/:id', removeFeedbackSetting);

module.exports = router;