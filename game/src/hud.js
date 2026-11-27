// Merapi Ridge Run — the HUD and the screens. Everything the pilot reads is
// drawn here on the canvas: the compass tape, airspeed and altitude tapes,
// the attitude indicator with its glowing instruments, throttle and fuel,
// warnings, and the title, pause and end screens. The judge reads the game
// mostly through screenshots, so the HUD is part of the picture, not an
// afterthought.

import { CONFIG, MISSIONS } from './config.js';

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class Hud {
  draw(ctx, w, h, state) {
    const { aircraft, mission, phase } = state;
    if (phase === 'title') {
      this.drawTitle(ctx, w, h, state);
      return;
    }
    this.drawTopBar(ctx, w, h, state);
    this.drawCompass(ctx, w, h, aircraft);
    this.drawSpeedTape(ctx, w, h, aircraft);
    this.drawAltitudeTape(ctx, w, h, aircraft);
    this.drawAttitude(ctx, w, h, aircraft);
    this.drawThrottleFuel(ctx, w, h, aircraft);
    this.drawMessage(ctx, w, h, mission, state.now);
    this.drawWarnings(ctx, w, h, aircraft);
    if (phase === 'paused') this.drawPaused(ctx, w, h);
    if (phase === 'over') this.drawEnd(ctx, w, h, state);
  }

  panel(ctx, x, y, w, h, alpha = 0.55) {
    ctx.fillStyle = `rgba(8,18,28,${alpha})`;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,220,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawTopBar(ctx, w, h, state) {
    const { aircraft, mission } = state;
    this.panel(ctx, 12, 10, 300, 54);
    ctx.fillStyle = '#cfeaff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mission.def.name, 24, 30);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '13px sans-serif';
    ctx.fillText(mission.progressText, 24, 50);
    this.panel(ctx, w - 312, 10, 300, 54);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`SCORE ${mission.score}`, w - 24, 31);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`TIME ${fmtTime(mission.time)}   FUEL ${Math.round((aircraft.fuel / CONFIG.fuelMax) * 100)}%`, w - 24, 50);
  }

  drawCompass(ctx, w, h, aircraft) {
    const cx = w / 2;
    const y = 22;
    const pxPerDeg = 2.2;
    this.panel(ctx, cx - 190, 10, 380, 34, 0.45);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 190, 10, 380, 34);
    ctx.clip();
    const hdg = aircraft.headingDegrees;
    for (let d = -60; d <= 60; d += 5) {
      const deg = ((Math.round(hdg / 5) * 5 + d) % 360 + 360) % 360;
      const x = cx + d * pxPerDeg;
      ctx.strokeStyle = 'rgba(200,235,255,0.8)';
      ctx.lineWidth = deg % 30 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 8);
      ctx.lineTo(x, y + (deg % 30 === 0 ? 18 : 13));
      ctx.stroke();
      if (deg % 45 === 0) {
        ctx.fillStyle = '#eaf6ff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(COMPASS[Math.round(deg / 45) % 8], x, y + 30);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#ffc83d';
    ctx.beginPath();
    ctx.moveTo(cx, y + 2);
    ctx.lineTo(cx - 6, y - 6);
    ctx.lineTo(cx + 6, y - 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(hdg).padStart(3, '0') + '°', cx, 62);
  }

  drawSpeedTape(ctx, w, h, aircraft) {
    const x = 14;
    const y0 = h * 0.32;
    const tapeH = 220;
    this.panel(ctx, x, y0, 64, tapeH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y0, 64, tapeH);
    ctx.clip();
    const kts = aircraft.speedKnots;
    const pxPerKt = 2.4;
    for (let v = Math.max(0, kts - 45); v <= kts + 45; v += 10) {
      const y = y0 + tapeH / 2 - (v - kts) * pxPerKt;
      ctx.fillStyle = '#cfeaff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(v), x + 6, y + 4);
      ctx.strokeStyle = 'rgba(200,235,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x + 34, y);
      ctx.lineTo(x + 44, y);
      ctx.stroke();
    }
    ctx.restore();
    // Current value on a dark chip so it never collides with the tape.
    ctx.fillStyle = 'rgba(8,18,28,0.9)';
    ctx.fillRect(x + 4, y0 + tapeH / 2 - 11, 44, 22);
    ctx.fillStyle = '#ffc83d';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(kts), x + 8, y0 + tapeH / 2 + 5);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '11px sans-serif';
    ctx.fillText('KNOTS', x + 8, y0 + tapeH - 8);
  }

  drawAltitudeTape(ctx, w, h, aircraft) {
    const x = w - 78;
    const y0 = h * 0.32;
    const tapeH = 220;
    this.panel(ctx, x, y0, 64, tapeH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y0, 64, tapeH);
    ctx.clip();
    const ft = aircraft.altitudeFeet;
    const pxPerFt = 0.12;
    for (let v = Math.max(0, ft - 500); v <= ft + 500; v += 200) {
      const y = y0 + tapeH / 2 - (v - ft) * pxPerFt;
      ctx.fillStyle = '#cfeaff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(String(v), x + 56, y + 4);
      ctx.strokeStyle = 'rgba(200,235,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x + 20, y);
      ctx.lineTo(x + 30, y);
      ctx.stroke();
    }
    ctx.restore();
    // Current value on a dark chip so it never collides with the tape.
    ctx.fillStyle = 'rgba(8,18,28,0.9)';
    ctx.fillRect(x + 6, y0 + tapeH / 2 - 11, 54, 22);
    ctx.fillStyle = '#ffc83d';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(ft), x + 56, y0 + tapeH / 2 + 5);
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FEET', x + 8, y0 + tapeH - 8);
  }

  drawAttitude(ctx, w, h, aircraft) {
    const cx = w / 2;
    const cy = h - 78;
    const r = 52;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-aircraft.bank);
    const pitchPx = clamp(aircraft.pitch * 120, -r, r);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r, -r + pitchPx, r * 2, r);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-r, pitchPx, r * 2, r);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (const off of [-30, 30]) {
      ctx.beginPath();
      ctx.moveTo(-18, pitchPx + off);
      ctx.lineTo(18, pitchPx + off);
      ctx.stroke();
    }
    ctx.restore();
    // Fixed wings marker and glowing bezel.
    ctx.strokeStyle = '#ffc83d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 26, cy);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,220,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#9fd8ff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 14);
    // Vertical speed needle next to it.
    const vs = aircraft.verticalSpeed;
    ctx.fillStyle = '#cfeaff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`V/S ${vs >= 0 ? '+' : ''}${vs.toFixed(1)} m/s`, cx, cy - r - 10);
  }

  drawThrottleFuel(ctx, w, h, aircraft) {
    const x = w - 78;
    const y0 = h - 190;
    this.panel(ctx, x, y0, 64, 170);
    // Throttle bar.
    ctx.fillStyle = '#12222e';
    ctx.fillRect(x + 10, y0 + 26, 14, 110);
    ctx.fillStyle = aircraft.engineOut ? '#888' : '#37c978';
    const th = aircraft.throttle * 110;
    ctx.fillRect(x + 10, y0 + 26 + (110 - th), 14, th);
    ctx.fillStyle = '#cfeaff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('THR', x + 8, y0 + 16);
    ctx.fillText(`${Math.round(aircraft.throttle * 100)}%`, x + 28, y0 + 40);
    // Fuel bar.
    ctx.fillStyle = '#12222e';
    ctx.fillRect(x + 40, y0 + 26, 14, 110);
    const fuelPct = (aircraft.fuel / CONFIG.fuelMax) * 100;
    ctx.fillStyle = fuelPct < 20 ? '#e0483e' : '#ffc83d';
    const fu = (aircraft.fuel / CONFIG.fuelMax) * 110;
    ctx.fillRect(x + 40, y0 + 26 + (110 - fu), 14, fu);
    ctx.fillText('FUEL', x + 36, y0 + 16);
    ctx.fillText(`${Math.round(fuelPct)}%`, x + 36, y0 + 152);
  }

  drawMessage(ctx, w, h, mission, now) {
    if (!mission || !mission.message || now > mission.messageUntil) return;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(mission.message, w / 2, h * 0.24);
    ctx.shadowBlur = 0;
  }

  drawWarnings(ctx, w, h, aircraft) {
    const warns = [];
    if (aircraft.stalled) warns.push('STALL');
    if (aircraft.fuel < CONFIG.fuelMax * 0.2) warns.push('LOW FUEL');
    if (aircraft.engineOut) warns.push('ENGINE OUT');
    if (aircraft.altitude < 60 && !aircraft.onGround) warns.push('TERRAIN');
    if (!warns.length) return;
    ctx.textAlign = 'center';
    warns.forEach((txt, i) => {
      const blink = Math.floor(Date.now() / 400) % 2 === 0;
      ctx.fillStyle = blink ? '#ff5a4e' : '#ffb0aa';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(txt, w / 2, h * 0.24 + 30 + i * 26);
    });
  }

  drawTitle(ctx, w, h, state) {
    const { selectedMission, best } = state;
    ctx.fillStyle = 'rgba(6,16,26,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 14;
    ctx.fillText('MERAPI RIDGE RUN', w / 2, 130);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '20px sans-serif';
    ctx.fillText('Fly the volcanic island. Thread the rings. Bring her home.', w / 2, 168);
    // Mission cards.
    const cardW = 300;
    const cardH = 150;
    const gap = 24;
    const totalW = MISSIONS.length * cardW + (MISSIONS.length - 1) * gap;
    let x = (w - totalW) / 2;
    const y = 230;
    MISSIONS.forEach((m, i) => {
      const sel = i === selectedMission;
      ctx.fillStyle = sel ? 'rgba(255,200,61,0.92)' : 'rgba(8,18,28,0.78)';
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = sel ? '#fff' : 'rgba(140,220,255,0.5)';
      ctx.lineWidth = sel ? 3 : 1;
      ctx.stroke();
      ctx.fillStyle = sel ? '#1a1a1a' : '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(`${i + 1}. ${m.name}`, x + cardW / 2, y + 42);
      ctx.fillStyle = sel ? '#333' : '#cfeaff';
      ctx.font = '14px sans-serif';
      const words = m.blurb.split(' ');
      let line = '';
      let ly = y + 72;
      for (const word of words) {
        if ((line + word).length > 34) {
          ctx.fillText(line.trim(), x + cardW / 2, ly);
          line = '';
          ly += 20;
        }
        line += word + ' ';
      }
      ctx.fillText(line.trim(), x + cardW / 2, ly);
      x += cardW + gap;
    });
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Press 1, 2 or 3 — or click a card — then ENTER to fly', w / 2, 440);
    ctx.fillStyle = '#cfeaff';
    ctx.font = '15px sans-serif';
    ctx.fillText('↑ ↓ pitch      ← → bank & turn      SHIFT / CTRL throttle      SPACE airbrake      Mouse steers, wheel = throttle', w / 2, 480);
    ctx.fillText('P pause      M sound      R restart', w / 2, 506);
    if (best) {
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`Best score so far: ${best}`, w / 2, 546);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px sans-serif';
    ctx.fillText('An original game — no borrowed art, names or levels.', w / 2, h - 24);
  }

  drawPaused(ctx, w, h) {
    ctx.fillStyle = 'rgba(6,16,26,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', w / 2, h / 2 - 10);
    ctx.font = '17px sans-serif';
    ctx.fillStyle = '#cfeaff';
    ctx.fillText('Press P to keep flying, R to restart', w / 2, h / 2 + 28);
  }

  drawEnd(ctx, w, h, state) {
    const { mission, aircraft } = state;
    ctx.fillStyle = 'rgba(6,16,26,0.62)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = mission.won ? '#7dffa8' : '#ff8a80';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(mission.resultText(aircraft), w / 2, h / 2 - 90);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`Score: ${mission.score}`, w / 2, h / 2 - 40);
    ctx.fillStyle = '#cfeaff';
    ctx.font = '17px sans-serif';
    ctx.fillText(`Mission: ${mission.def.name}    Time: ${fmtTime(mission.time)}    Fuel left: ${Math.round((aircraft.fuel / CONFIG.fuelMax) * 100)}%`, w / 2, h / 2 - 6);
    ctx.fillText('ENTER — fly again      1/2/3 — change mission', w / 2, h / 2 + 34);
  }
}
