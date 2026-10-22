export async function sendWhatsAppAlert(message: string) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_API_KEY;

  if (!phone || !apiKey) {
    console.warn("WhatsApp Alert Skipped: CALLMEBOT_PHONE or CALLMEBOT_API_KEY is not set in .env");
    return;
  }

  // CallMeBot API requires the message to be URL encoded
  const encodedMessage = encodeURIComponent(message);
  const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`;

  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      console.error("Failed to send WhatsApp message. CallMeBot API responded with:", response.status);
    }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
  }
}
