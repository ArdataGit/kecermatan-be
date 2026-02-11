const axios = require('axios');

/**
 * Verify Google Access Token by fetching user info
 * @param {string} accessToken
 * @returns {Promise<{email: string, name: string, picture: string, sub: string}>}
 */
const verifyGoogleToken = async (accessToken) => {
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Google user info:', error.response?.data || error.message);
    throw new Error('Invalid Google Access Token');
  }
};

module.exports = { verifyGoogleToken };
