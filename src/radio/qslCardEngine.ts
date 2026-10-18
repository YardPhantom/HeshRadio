/**
 * AutoQSL Postcard Canvas Engine
 * Generates high-resolution (1200 x 750 px) tactical & vintage amateur radio
 * QSL confirmation postcards ready for instant digital rendering and PNG download.
 */

import { AdifQsoRecord } from './adifLogger';
import { calculateGeodesy } from './geodesy';

export class QslCardEngine {
  /**
   * Renders a high-resolution QSL card onto an HTML5 Canvas.
   */
  public static renderCard(
    canvas: HTMLCanvasElement,
    record: AdifQsoRecord,
    myCallsign: string = 'HESHRADIO'
  ): void {
    const width = 1200;
    const height = 750;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background Gradient (Dark tactical navy / carbon slate)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#090D16');
    bgGrad.addColorStop(0.5, '#0F172A');
    bgGrad.addColorStop(1, '#050811');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Subtle Background Grid Pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 3. Tactical Border Frame & Corner Rivets
    ctx.strokeStyle = '#F59E0B'; // Amber accent
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, width - 48, height - 48);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(32, 32, width - 64, height - 64);

    // Corner crosshairs / rivets
    const drawRivet = (cx: number, cy: number) => {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    };
    drawRivet(32, 32);
    drawRivet(width - 32, 32);
    drawRivet(32, height - 32);
    drawRivet(width - 32, height - 32);

    // 4. Header Bar
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.fillRect(34, 34, width - 68, 54);

    ctx.font = '700 14px "Courier New", monospace';
    ctx.fillStyle = '#F59E0B';
    ctx.textAlign = 'left';
    ctx.fillText('OFFICIAL TWO-WAY AMATEUR & CB RADIO CONFIRMATION CARD', 56, 66);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('HESHRADIO TACTICAL SDR // ADIF 3.1.4 VERIFIED', width - 56, 66);

    // 5. Hero Callsign Banner
    // My Station Callsign
    ctx.textAlign = 'left';
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.fillStyle = '#F59E0B';
    const senderCall = (record.operator || myCallsign).toUpperCase();
    ctx.fillText(senderCall, 56, 160);

    ctx.font = '600 16px "Courier New", monospace';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(
      `GRID LOCATOR: ${record.myGridSquare || 'CN87uq'}  •  TRANSMITTER: 100W PEP`,
      58,
      192
    );

    // "CONFIRMING TWO-WAY QSO WITH" Box
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width - 480, 105, 420, 100, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CONFIRMING TWO-WAY CONTACT WITH', width - 270, 132);

    ctx.fillStyle = '#10B981'; // Emerald
    ctx.font = '900 44px "Courier New", monospace';
    ctx.fillText(record.call.toUpperCase(), width - 270, 180);

    // 6. Data Matrix / Field Grid
    const startY = 225;
    const boxWidth = width - 112;
    const boxHeight = 350;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(56, startY, boxWidth, boxHeight, 10);
    ctx.fill();
    ctx.stroke();

    // Field table setup
    const rowHeight = 70;
    const drawField = (
      colX: number,
      rowY: number,
      _colW: number,
      label: string,
      value: string,
      highlightColor = '#F8FAFC'
    ) => {
      ctx.textAlign = 'left';
      ctx.font = '700 11px "Courier New", monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText(label.toUpperCase(), colX + 16, rowY + 26);

      ctx.font = '700 22px system-ui, sans-serif';
      ctx.fillStyle = highlightColor;
      ctx.fillText(value, colX + 16, rowY + 54);
    };

    // Date formatting
    const rawDate = record.qsoDate;
    const formattedDate =
      rawDate.length === 8
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
        : rawDate;
    const rawTime = record.timeOn;
    const formattedTime =
      rawTime.length >= 4
        ? `${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}${rawTime.length >= 6 ? `:${rawTime.slice(4, 6)}` : ''} UTC`
        : rawTime;

    // Row 1: UTC Date | UTC Time | Band & Frequency | Mode
    drawField(56, startY, 260, 'UTC DATE', formattedDate, '#F8FAFC');
    drawField(316, startY, 240, 'UTC TIME', formattedTime, '#38BDF8');
    drawField(556, startY, 280, 'BAND & FREQUENCY', `${record.band} (${record.freqMhz} MHz)`, '#F59E0B');
    drawField(836, startY, 308, 'OPERATING MODE', `${record.mode}${record.submode ? `-${record.submode}` : ''}`, '#10B981');

    // Horizontal Divider 1
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(56, startY + rowHeight);
    ctx.lineTo(56 + boxWidth, startY + rowHeight);
    ctx.stroke();

    // Row 2: RST Sent / Rcvd | Remote Grid | Great Circle Geodesy | Operator Name
    const rstCombined = `${record.rstSent} / ${record.rstRcvd}`;
    drawField(56, startY + rowHeight, 260, 'RST REPORT (S/R)', rstCombined, '#F8FAFC');
    drawField(316, startY + rowHeight, 240, 'REMOTE GRID', record.gridSquare || '—', '#38BDF8');

    // Geodesy info
    let geodesyText = '—';
    if (record.distanceMiles && record.bearingDeg !== undefined) {
      geodesyText = `${record.distanceMiles} mi @ ${record.bearingDeg}°`;
    } else if (record.myGridSquare && record.gridSquare) {
      const geo = calculateGeodesy(record.myGridSquare, record.gridSquare);
      if (geo) {
        geodesyText = `${geo.distanceMiles} mi (${geo.distanceKm} km) @ ${geo.bearingDeg}° ${geo.compassDir}`;
      }
    }
    drawField(556, startY + rowHeight, 280, 'GREAT CIRCLE BEARING', geodesyText, '#F59E0B');
    drawField(836, startY + rowHeight, 308, 'CONTACT NAME', record.name || 'Station Operator', '#F8FAFC');

    // Horizontal Divider 2
    ctx.beginPath();
    ctx.moveTo(56, startY + rowHeight * 2);
    ctx.lineTo(56 + boxWidth, startY + rowHeight * 2);
    ctx.stroke();

    // Row 3: POTA / SOTA Reference | Comments & Equipment
    const potaSota = record.potaRef
      ? `POTA: ${record.potaRef}`
      : record.sotaRef
      ? `SOTA: ${record.sotaRef}`
      : 'STANDARD QSO';
    drawField(56, startY + rowHeight * 2, 350, 'SPECIAL ACTIVITY (POTA / SOTA)', potaSota, record.potaRef || record.sotaRef ? '#EC4899' : '#94A3B8');
    drawField(406, startY + rowHeight * 2, boxWidth - 350, 'QSO REMARKS & PROPAGATION', record.comment || 'Verified amateur radio two-way contact', '#CBD5E1');

    // Horizontal Divider 3
    ctx.beginPath();
    ctx.moveTo(56, startY + rowHeight * 3);
    ctx.lineTo(56 + boxWidth, startY + rowHeight * 3);
    ctx.stroke();

    // Row 4: Signature / Operator Handle Note
    ctx.textAlign = 'left';
    ctx.font = 'italic 14px "Courier New", monospace';
    ctx.fillStyle = '#64748B';
    ctx.fillText(
      `Thanks for the contact, 73 from ${record.operator || myCallsign}! Logged into ADIF 3.1.4 by HeshRadio.`,
      72,
      startY + rowHeight * 3 + 42
    );

    // 7. Authentic Red "VERIFIED TWO-WAY QSO" Rubber Stamp
    ctx.save();
    ctx.translate(width - 200, height - 120);
    ctx.rotate((-14 * Math.PI) / 180);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'; // Crimson red stamp
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, 68, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
    ctx.textAlign = 'center';
    ctx.font = '900 11px system-ui, sans-serif';
    ctx.fillText('★ 2-WAY QSO ★', 0, -32);
    ctx.font = '900 18px "Courier New", monospace';
    ctx.fillText('CONFIRMED', 0, -6);
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.fillText('HESHRADIO ADIF', 0, 16);
    ctx.fillText(formattedDate, 0, 32);
    ctx.restore();

    // 8. Bottom Footer Status
    ctx.textAlign = 'left';
    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#64748B';
    ctx.fillText('HESHRADIO // REAL-TIME AMATEUR & CB SYSTEMS SUITE // WORLD RADIO LEAGUE READY', 56, height - 36);

    ctx.textAlign = 'right';
    ctx.fillText(`RECORD ID: ${record.id}`, width - 56, height - 36);
  }

  /**
   * Generates a downloadable PNG Data URL of the QSL card.
   */
  public static generateDataUrl(
    record: AdifQsoRecord,
    myCallsign: string = 'HESHRADIO'
  ): string {
    const canvas = document.createElement('canvas');
    this.renderCard(canvas, record, myCallsign);
    return canvas.toDataURL('image/png');
  }
}
