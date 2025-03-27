// Special API endpoint to force-reset the user's session state
export default function handler(req, res) {
  try {
    // Set headers to clear cookies
    res.setHeader('Set-Cookie', [
      // Clear all common next-auth cookies
      'next-auth.session-token=; Path=/; Max-Age=0; HttpOnly',
      'next-auth.csrf-token=; Path=/; Max-Age=0; HttpOnly',
      'next-auth.callback-url=; Path=/; Max-Age=0; HttpOnly',
      'next-auth.pkce-code-verifier=; Path=/; Max-Age=0; HttpOnly',
      '__Secure-next-auth.session-token=; Path=/; Max-Age=0; HttpOnly; Secure',
      '__Host-next-auth.csrf-token=; Path=/; Max-Age=0; HttpOnly; Secure',
      // Any other session cookies
      'next-auth.callback-url=; Path=/; Max-Age=0',
    ]);

    // Set headers to prevent caching
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    
    // Also include the Clear-Site-Data header (modern browsers)
    res.setHeader('Clear-Site-Data', '"cookies", "storage"');

    // Return success
    return res.status(200).json({ 
      success: true, 
      message: 'Session reset successful' 
    });
  } catch (error) {
    console.error('Error resetting session:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to reset session' 
    });
  }
} 