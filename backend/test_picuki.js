const axios = require('axios');

async function check() {
  try {
    const res = await axios.get('https://www.picuki.com/profile/manisha.eerabathini', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      timeout: 10000
    });
    console.log('STATUS:', res.status);
    console.log('HTML LENGTH:', res.data.length);
    // Find profile picture in HTML
    const match = res.data.match(/<div class="profile-avatar"[^>]*style="background-image:\s*url\('([^']*)'\)"/i) ||
                  res.data.match(/class="profile-avatar-image"[^>]*src="([^"]*)"/i) ||
                  res.data.match(/<img[^>]*class="[^"]*profile[^"]*"[^>]*src="([^"]*)"/i);
    console.log('AVATAR MATCH:', match ? match[1] : 'None');
    if (!match) {
      // Print first 1000 chars of HTML to see if blocked
      console.log('HTML SNIPPET:', res.data.slice(0, 1000));
    }
  } catch (err) {
    console.error('ERROR:', err.message);
  }
}
check();
