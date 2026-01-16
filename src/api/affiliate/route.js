// src/api/user/route.js (Updated with affiliate routes, asumsikan admin middleware di app level)
const express = require('express');

const router = express.Router();

const {
  // Affiliate
  getAffiliateList,
  getAffiliateCommissionList,
  generateAllAffiliateCodes,
  createAffiliate,
  updateAffiliate,
  updateAffiliateCommission,
  deleteAffiliate,
  requestWithdraw,
  getAffiliateHistory,
  approveWithdraw,
  rejectWithdraw,
  getUserWithdrawals,
  getAffiliateTransactionHistory,
  massUpdateCommission,
  getAffiliateData,
  getMyAffiliateData,
  getAffiliateWithdrawalsByUserId,
  getAllAffiliateWithdrawals,
} = require('./controller');
const { upload } = require('#utils');
// Affiliate Routes (Admin only)
router.get('/affiliate/list', getAffiliateList);
router.get('/affiliate/commission', getAffiliateCommissionList);
router.post('/affiliate/generate-all', generateAllAffiliateCodes);
router.post('/affiliate/create', createAffiliate);
router.patch('/affiliate/:id/update', updateAffiliate);
router.patch('/affiliate/:id/update-commission', updateAffiliateCommission);
router.delete('/affiliate/:id', deleteAffiliate);
router.post('/affiliate/withdraw', requestWithdraw); // User or admin
router.get('/affiliate/:id/history', getAffiliateHistory);
router.patch('/affiliate/withdraw/:id/approve', approveWithdraw);
router.patch('/affiliate/withdraw/:id/reject', rejectWithdraw);
router.get('/affiliate/withdrawals/:userId', getUserWithdrawals);
router.get('/affiliate/history/:userId', getAffiliateTransactionHistory);
router.post('/affiliate/mass-update-commission', massUpdateCommission);
router.get('/affiliate/:id', getAffiliateData);
router.post('/affiliateuser', getMyAffiliateData);
router.post('/history/withdraw', getAffiliateWithdrawalsByUserId);
router.get('/history/withdraw-all', getAllAffiliateWithdrawals);

module.exports = router;