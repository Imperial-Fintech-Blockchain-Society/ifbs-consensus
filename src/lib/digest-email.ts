type DigestPitch = {
  id: string;
  ticker: string;
  title: string;
  thesis: string;
  _count: { votes: number };
};

function escape(text: string) {
  return text.replace(
    /[&<>"'{}]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "{": "&#123;",
        "}": "&#125;",
      })[c]!,
  );
}

export function renderDigestEmail(base: string, pitches: DigestPitch[]) {
  const appUrl = escape(base.replace(/\/$/, ""));
  const count = pitches.length;
  const cards = pitches
    .map((pitch, index) => {
      const excerpt = pitch.thesis.slice(0, 240);
      const url = `${appUrl}/pitches/${encodeURIComponent(pitch.id)}`;
      return `<tr><td class="content-pad" style="padding:0 32px 20px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #dfe5ef;border-radius:12px;background:#ffffff">
          <tr><td style="padding:24px;overflow-wrap:anywhere;word-break:break-word">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
              <td style="font-size:12px;line-height:20px;font-weight:700;letter-spacing:0.6px;color:#216cf0"><span style="display:inline-block;padding:3px 10px;background:#edf3ff;border-radius:6px">${escape(pitch.ticker)}</span></td>
              <td align="right" style="font-size:12px;line-height:20px;color:#657089">${pitch._count.votes} ${pitch._count.votes === 1 ? "vote" : "votes"}</td>
            </tr></table>
            <h2 style="margin:18px 0 10px;font-size:22px;line-height:29px;letter-spacing:-0.4px;font-weight:700;color:#142044">${escape(pitch.title)}</h2>
            <p style="margin:0 0 22px;font-size:15px;line-height:24px;color:#526079">${escape(excerpt)}${pitch.thesis.length > excerpt.length ? "…" : ""}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#216cf0" style="border-radius:7px;mso-padding-alt:12px 18px"><a href="${url}" aria-label="Read the thesis and vote on idea ${index + 1}" style="display:inline-block;padding:12px 18px;border:1px solid #216cf0;border-radius:7px;font-size:14px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none">Read thesis &amp; vote&nbsp; &rarr;</a></td></tr></table>
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>This week’s investment ideas · IFBS Consensus</title>
<style>@media only screen and (max-width:620px){.outer-pad{padding:16px 8px!important}.content-pad{padding-left:20px!important;padding-right:20px!important}.hero-title{font-size:30px!important;line-height:36px!important}}</style>
</head><body style="margin:0;padding:0;width:100%;background:#f1f4f9;font-family:Arial,Helvetica,sans-serif;color:#142044;-webkit-text-size-adjust:100%;text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${count} ${count === 1 ? "investment idea" : "investment ideas"} to explore. Read the research and add your vote.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f1f4f9"><tr><td class="outer-pad" align="center" style="padding:36px 16px">
<!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#f8faff;border:1px solid #dfe5ef;border-radius:16px;overflow:hidden">
  <tr><td class="content-pad" bgcolor="#142044" style="padding:28px 32px;border-top:4px solid #216cf0;border-radius:16px 16px 0 0">
    <a href="${appUrl}/dashboard" style="font-size:15px;line-height:22px;font-weight:700;letter-spacing:1px;color:#ffffff;text-decoration:none">IFBS <span style="color:#8fa7ce">/</span> CONSENSUS</a>
    <p style="margin:6px 0 0;font-size:11px;line-height:18px;letter-spacing:0.3px;color:#bdcbea">Imperial Fintech &amp; Blockchain Society</p>
  </td></tr>
  <tr><td class="content-pad" style="padding:32px 32px 28px">
    <p style="margin:0 0 12px;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.6px;color:#216cf0">THE WEEKLY DIGEST</p>
    <h1 class="hero-title" style="margin:0 0 14px;font-size:36px;line-height:42px;letter-spacing:-1px;color:#142044;font-weight:700">This week’s<br>investment ideas.</h1>
    <p style="margin:0;font-size:16px;line-height:26px;color:#526079">Explore the research. Share your perspective.<br>Help shape our member-led paper fund.</p>
    <p style="margin:22px 0 0;font-size:12px;line-height:20px;font-weight:700;color:#526079">${count} ${count === 1 ? "IDEA" : "IDEAS"} &nbsp;&bull;&nbsp; YOUR VOTE COUNTS</p>
  </td></tr>
  ${cards}
  <tr><td class="content-pad" style="padding:8px 32px 32px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding-top:24px;border-top:1px solid #dfe5ef">
      <p style="margin:0 0 8px;font-size:16px;line-height:24px;font-weight:700;color:#142044">See the bigger picture.</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#526079">Follow the portfolio and explore all active pitches.</p>
      <a href="${appUrl}/dashboard" style="font-size:14px;line-height:22px;font-weight:700;color:#216cf0;text-decoration:underline">Open Consensus &rarr;</a>
    </td></tr></table>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto"><tr><td align="center" style="padding:24px 20px 0;font-size:12px;line-height:20px;color:#657089">
  <p style="margin:0 0 6px;font-weight:700">Ideas from members. Decisions together.</p>
  <p style="margin:0 0 14px">Paper investments only. No real money is invested.</p>
  <p style="margin:0 0 8px"><a href="${appUrl}/account" style="color:#526079;text-decoration:underline">Email preferences</a> &nbsp;&middot;&nbsp; <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#526079;text-decoration:underline">Unsubscribe</a></p>
  <p style="margin:0;font-size:11px;line-height:18px">You’re receiving this because you enabled the weekly digest in Consensus.</p>
</td></tr></table>
</td></tr></table></body></html>`;
}
