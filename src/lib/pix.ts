// PIX EMV QR Code payload generator
// Based on the BR Code specification (Banco Central do Brasil)

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function generatePixPayload(amount: number, txId: string): string {
  const pixKey = "63540052000170"; // CNPJ
  const merchantName = "EDUARDA THAMMYRES DOS SANTOS";
  const merchantCity = "MESSIAS";

  // ID 26 - Merchant Account Information (PIX)
  const gui = tlv("00", "BR.GOV.BCB.PIX");
  const key = tlv("01", pixKey);
  const merchantAccount = tlv("26", gui + key);

  // Build payload without CRC
  let payload = "";
  payload += tlv("00", "01"); // Payload Format Indicator
  payload += merchantAccount;
  payload += tlv("52", "0000"); // Merchant Category Code
  payload += tlv("53", "986"); // Transaction Currency (BRL)
  payload += tlv("54", amount.toFixed(2)); // Transaction Amount
  payload += tlv("58", "BR"); // Country Code
  payload += tlv("59", merchantName); // Merchant Name
  payload += tlv("60", merchantCity); // Merchant City
  payload += tlv("62", tlv("05", txId)); // Additional Data Field (Reference Label)
  payload += "6304"; // CRC placeholder (ID + length)

  // Calculate CRC16
  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}
