const nodemailer = require('nodemailer');

// Create reusable transporter using Gmail SMTP
let transporter = null;
const getMailTransporter = () => {
  if (!transporter) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('EMAIL_USER and EMAIL_PASSWORD must be set in environment variables');
    }
    
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  return transporter;
};

// Generate a 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email verification code
const sendVerificationEmail = async (email, name, code) => {
  try {
    const transporter = getMailTransporter();
    
    const mailOptions = {
      from: `"TESDA Inventory System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - TESDA Inventory System',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #ffffff;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                padding: 40px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #2563eb;
                margin-bottom: 10px;
              }
              .code-box {
                background: #f3f4f6;
                border: 2px dashed #2563eb;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 30px 0;
              }
              .code {
                font-size: 32px;
                font-weight: bold;
                color: #2563eb;
                letter-spacing: 8px;
                margin: 10px 0;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                font-size: 14px;
                color: #6b7280;
              }
              .warning {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 12px;
                margin: 20px 0;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🏢 TESDA Inventory System</div>
                <h2>Email Verification</h2>
              </div>
              
              <p>Hello ${name},</p>
              
              <p>Thank you for registering with TESDA Inventory Management System. To complete your registration, please use the verification code below:</p>
              
              <div class="code-box">
                <div>Your Verification Code</div>
                <div class="code">${code}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 10px;">Valid for 10 minutes</div>
              </div>
              
              <p>Enter this code in the verification page to activate your account.</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request this verification code, please ignore this email. Do not share this code with anyone.
              </div>
              
              <div class="footer">
                <p>This is an automated message from TESDA Inventory Management System.</p>
                <p>&copy; ${new Date().getFullYear()} TESDA PTC. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
};

// Send password reset code
const sendPasswordResetEmail = async (email, name, code) => {
  try {
    const transporter = getMailTransporter();
    
    const mailOptions = {
      from: `"TESDA Inventory System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Code - TESDA Inventory System',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #ffffff;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                padding: 40px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #dc2626;
                margin-bottom: 10px;
              }
              .code-box {
                background: #fef2f2;
                border: 2px dashed #dc2626;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                margin: 30px 0;
              }
              .code {
                font-size: 32px;
                font-weight: bold;
                color: #dc2626;
                letter-spacing: 8px;
                margin: 10px 0;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                font-size: 14px;
                color: #6b7280;
              }
              .warning {
                background: #fef3c7;
                border-left: 4px solid #f59e0b;
                padding: 12px;
                margin: 20px 0;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">🔒 TESDA Inventory System</div>
                <h2>Password Reset Request</h2>
              </div>
              
              <p>Hello ${name},</p>
              
              <p>We received a request to reset your password for your TESDA Inventory Management System account. Use the code below to reset your password:</p>
              
              <div class="code-box">
                <div>Your Password Reset Code</div>
                <div class="code">${code}</div>
                <div style="font-size: 14px; color: #6b7280; margin-top: 10px;">Valid for 15 minutes</div>
              </div>
              
              <p>Enter this code in the password reset page to create a new password.</p>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure. Do not share this code with anyone.
              </div>
              
              <div class="footer">
                <p>This is an automated message from TESDA Inventory Management System.</p>
                <p>&copy; ${new Date().getFullYear()} TESDA PTC. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email service error:', error);
    throw error;
  }
};

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
