# Supporting presentation builder; does not call AI or touch the app database.
from pathlib import Path
from math import cos, sin, pi
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from xml.sax.saxutils import escape

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/pdf/Nile_Submission_Presentation.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
fontroot=Path('/System/Library/Fonts/Supplemental')
for name,file in [('NileSans','Arial.ttf'),('NileSansBold','Arial Bold.ttf'),('NileSerif','Georgia.ttf')]:
 if (fontroot/file).exists():
  pdfmetrics.registerFont(TTFont(name,str(fontroot/file)))
 else:
  fallback={'NileSans':'Helvetica','NileSansBold':'Helvetica-Bold','NileSerif':'Times-Roman'}[name]
  pdfmetrics.registerFont(pdfmetrics.Font(name,fallback,'WinAnsiEncoding'))
pdfmetrics.registerFontFamily('NileSans',normal='NileSans',bold='NileSansBold',italic='NileSans',boldItalic='NileSansBold')
W,H=960,540
GREEN=HexColor('#214535'); CREAM=HexColor('#F4EFE5'); INK=HexColor('#253D30'); ORANGE=HexColor('#BF7947'); MOSS=HexColor('#6D8559'); PALE=HexColor('#E6EBD9'); WHITE=HexColor('#FFFCF6'); MUTED=HexColor('#66765E'); BROWN=HexColor('#624333')
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('Nile - Coffee Waste-to-Value | Climate Hack-tion')
c.setAuthor('Nile team')
c.setSubject('Working local prototype, COP31 priority alignment, validation and tools disclosure')

def txt(text,x,y,size=12,color=INK,font='NileSans'):
 c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,text)

def para(text,x,y,width,size=13,color=INK,bold=False,leading=None):
 style=ParagraphStyle('p',fontName='NileSansBold' if bold else 'NileSans',fontSize=size,leading=leading or size*1.4,textColor=color)
 p=Paragraph(text,style); pw,ph=p.wrap(width,1000)
 p.drawOn(c,x,y-ph)
 return y-ph

def box(x,y,w,h,fill=WHITE,stroke=None,r=16):
 c.setFillColor(fill)
 if stroke:c.setStrokeColor(stroke)
 c.roundRect(x,y,w,h,r,stroke=1 if stroke else 0,fill=1)

def header(n,label,title,subtitle=None):
 c.setFillColor(CREAM);c.rect(0,0,W,H,fill=1,stroke=0)
 txt('nile.',40,H-42,26,GREEN,'NileSerif')
 txt('CLIMATE HACK-TION / WORKING LOCAL PROTOTYPE',143,H-33,9,MUTED,'NileSansBold')
 txt(f'{n:02d} / {label.upper()}',40,H-86,10,ORANGE,'NileSansBold')
 txt(title,40,H-127,30,GREEN,'NileSerif')
 if subtitle:para(subtitle,40,H-144,880,12,MUTED)
 c.setStrokeColor(HexColor('#D5DAC9'));c.line(40,35,W-40,35)
 txt('Nile | 4 October 2026 | Fictional fixtures; no real pilot impact claimed',40,20,8,MUTED)
 txt(f'{n} / 6',W-76,20,8,MUTED)

def end():c.showPage()

def arrow(x1,y1,x2,y2,color=ORANGE):
 c.setStrokeColor(color);c.setFillColor(color);c.setLineWidth(2);c.line(x1,y1,x2,y2)
 a=__import__('math').atan2(y2-y1,x2-x1)
 path=c.beginPath();path.moveTo(x2,y2);path.lineTo(x2-8*cos(a-.5),y2-8*sin(a-.5));path.lineTo(x2-8*cos(a+.5),y2-8*sin(a+.5));path.close();c.drawPath(path,fill=1,stroke=0)

def bean(x,y,scale=1):
 c.saveState();c.translate(x,y);c.rotate(-30);c.scale(scale,scale);c.setFillColor(BROWN);c.ellipse(-19,-29,19,29,stroke=0,fill=1)
 c.setStrokeColor(HexColor('#C7A88A'));c.setLineWidth(2.4);p=c.beginPath();p.moveTo(0,-22);p.curveTo(-9,-8,9,8,0,22);c.drawPath(p,stroke=1);c.restoreState()

# 1 - opening / problem
c.setFillColor(GREEN);c.rect(0,0,W,H,fill=1,stroke=0)
txt('nile.',45,482,40,CREAM,'NileSerif')
txt('COFFEE INTO CLIMATE ACTION',47,437,11,HexColor('#D4DABB'),'NileSansBold')
para('Give coffee<br/>a next life.',45,410,475,47,CREAM,leading=52)
para('Surplus beans and coffee by-products.<br/>Compatible recipients. Clear value. Easier collection.',48,266,470,17,CREAM)
box(50,91,455,102,HexColor('#2E5340'))
txt('~75,000 tonnes / year',69,153,27,HexColor('#E2AE7E'),'NileSansBold')
para('Spent coffee grounds generated in Australia.<br/>RMIT estimate, 2023. Context, not Nile impact.',70,134,407,11,CREAM)
# Orbit graphic uses original vector artwork, not a stock image.
c.setStrokeColor(HexColor('#839274'));c.setLineWidth(.8);c.ellipse(594,196,866,404,stroke=1,fill=0)
bean(640,355,1.3)
c.setFillColor(CREAM);c.roundRect(776,276,42,35,7,stroke=0,fill=1)
c.setStrokeColor(CREAM);c.setLineWidth(4);c.ellipse(810,283,832,302,stroke=1,fill=0)
c.setStrokeColor(ORANGE);c.setLineWidth(2);c.ellipse(781,303,813,311,stroke=1,fill=0)
for i in range(28):
 a=i*2.4;r=7+(i%5)*4;c.setFillColor(ORANGE if i%3 else HexColor('#9CA77B'));c.circle(676+cos(a)*r,210+sin(a)*r*.4,1.8,stroke=0,fill=1)
txt('BEANS',615,313,10,CREAM,'NileSansBold');txt('LATTE',780,252,10,CREAM,'NileSansBold');txt('GROUNDS',648,171,10,CREAM,'NileSansBold')
arrow(676,364,769,331,ORANGE);arrow(791,254,712,219,ORANGE)
para('One requirement-aware engine<br/>for coffee materials at different stages.',585,119,310,15,CREAM)
source='https://www.rmit.edu.au/news/all-news/2023/aug/coffee-concrete'
c.linkURL(source,(70,98,477,132),relative=0)
txt('Source: RMIT, "Coffee offers performance boost for concrete", 23 August 2023',48,34,8,HexColor('#CDD7BD'))
txt('1 / 6',884,24,8,CREAM)
end()

# 2 - alignment
header(2,'COP31 priorities','A material route that supports climate action.','Primary: Zero Waste & Methane Reduction. Secondary: Green Industrialisation. Supporting: Awareness.')
cols=[(40,'01','ZERO WASTE + METHANE','Keep usable beans in use and match suitable organic residues with accepting destinations.','Climate benefit depends on the actual disposal baseline, destination and collection.'),(340,'02','GREEN INDUSTRIALISATION','Help processors compare coffee by-products as potential inputs and record material reported used.','Chaff, pulp and husks are catalogue pathways; their commercial routes need validation.'),(640,'03','AWARENESS','Explain why a match fits, what it costs and what remains unknown. Turn knowledge into a handover.','Clear requirements and evidence states help suppliers and recipients make decisions.')]
for x,num,title,body,note in cols:
 box(x,88,280,253)
 txt(num,x+20,308,23,ORANGE,'NileSerif')
 para(title,x+20,279,240,12,GREEN,True)
 para(body,x+20,245,240,14)
 para(note,x+20,146,240,10,MUTED)
para('Changing what happens to material is the intervention. The dashboard records that change.',40,68,880,11,MUTED)
c.linkURL('https://hackjunction.app/hackathons/climate-hack-tion',(40,57,700,77),relative=0)
end()

# 3 - engine workflow
header(3,'Waste-to-value engine','Compatibility first. Value after costs.','Cafes and other suppliers connect with recipients that can actually use the batch.')
steps=[('01','List','Material, measured quantity, condition and availability.'),('02','Compare','Check freshness, packaging, capacity, timing and costs.'),('03','Agree','Prepare the collection brief and reserve the batch.'),('04','Confirm','Record receipt, then separately report actual use.')]
for i,(n,t,b) in enumerate(steps):
 x=40+i*226;box(x,266,204,85,PALE)
 txt(n,x+14,326,10,ORANGE,'NileSansBold');txt(t,x+37,325,16,GREEN,'NileSansBold')
 para(b,x+14,309,177,10.5)
 if i<3:arrow(x+207,309,x+222,309)
box(40,151,428,94)
para('<b>Two complete demo pathways</b>',57,231,394,14)
para('Spent grounds -&gt; sample mushroom grower / compost processor.<br/>Surplus roasted beans -&gt; sample cafe.',57,204,394,12)
box(488,151,432,94)
para('<b>Why the top quote is not enough</b>',505,231,397,14)
para('Net benefit = sale revenue + documented avoided disposal cost - extra handling - collection costs.',505,204,397,12)
# Physical quantities stay visually distinct.
for x,value,label in [(40,'30 kg','proposed'),(341,'27 kg','accepted'),(642,'25 kg','reported used')]:
 txt(value,x+24,103,28,ORANGE,'NileSansBold');txt(label,x+24,80,12,MUTED)
 if x<642:arrow(x+169,107,x+271,107)
para('Fictional demonstration example. A transfer and a recipient use report are separate evidence.',40,59,880,10,MUTED)
end()

# 4 - adoption
header(4,'Why people participate','Make the handover fit the working day.','The reason to join: clearer value, fewer collection questions and a practical reason to return.')
items=[('SUPPLIER','Tell us what you have.','Reuse listing details and see compatibility, missing inputs and net value after costs.','Repeat listing + recipient-specific preparation + readiness checklist.'),('RECIPIENT','Know what you are collecting.','Review preparation, containers, access and time in one shared brief. Changes require renewed approval.','Agreed pickup + actual accepted weight + shared receipt.'),('REPEAT USE','Plan the next purchase.','Upload daily coffee-use or sales totals locally. Compare a suggested bean order with stock, goals and budget.','Browser-only CSV planning; forecasts are estimates, not realized savings.')]
for i,(label,title,body,foot) in enumerate(items):
 x=40+i*300;box(x,89,280,253)
 txt(label,x+18,312,10,ORANGE,'NileSansBold')
 para(title,x+18,284,244,18,GREEN,True)
 para(body,x+18,224,244,13)
 para(foot,x+18,133,244,10,MUTED)
para('Participation records describe the evidence. They are not COP31 or B Corp certification.',40,68,880,11,MUTED)
end()

# 5 - architecture and proof
header(5,'Build and validation','A working local product with clear boundaries.','List -> match -> shared collection agreement -> two-sided receipt -> recipient use report.')
box(40,266,210,85,PALE);para('<b>Supplier / recipient / network UI</b><br/>Next.js + React + TypeScript',55,333,180,12)
arrow(255,309,284,309)
box(292,266,210,85,PALE);para('<b>Validated API + rules</b><br/>Zod, current capacity, atomic reservations',307,333,180,12)
arrow(507,309,536,309)
box(544,266,178,85,PALE);para('<b>SQLite</b><br/>Persistent listings, transfers and explanations',559,333,148,12)
c.setStrokeColor(ORANGE);c.setLineWidth(1);c.line(397,351,397,363);c.line(397,363,832,363);arrow(832,363,832,351);txt('Optional explanation',550,371,8,MUTED)
box(744,266,176,85,WHITE);para('<b>OpenAI adapter</b><br/>Structured explanations; rules fallback active',759,333,146,11)
box(40,93,425,150,WHITE)
para('<b>48 unit/database + 13 browser/API tests</b>',57,228,392,17,GREEN)
para('Both material pathways, concurrent reservations, collection revisions, receipt/use quantities, mobile access, AI fallback and local SQL access-policy tests.',57,179,392,12)
para('Passing automated tests support implementation quality; they do not validate a real pilot.',57,116,392,9.5,MUTED)
box(487,93,433,150,WHITE)
para('<b>Connection status</b>',505,228,397,17,GREEN)
para('<b>Working:</b> local SQLite and demo role switching.<br/><b>Prepared:</b> Supabase schema and scoped read policies.<br/><b>Pending:</b> API key/live AI, hosted Auth and cloud repository.',505,193,397,12)
para('No public deployment. Demo role switching is not account authentication.',505,118,397,9.5,MUTED)
end()

# 6 - impact and disclosure
header(6,'Impact, next step and disclosure','Measure the route. Validate the climate result.','No real pilot impact is claimed. Buyers, demand, capacities and quotes are fictional demo fixtures.')
box(40,91,280,254,WHITE)
para('<b>Record what happened</b>',57,328,244,17,GREEN)
para('Accepted weight and separately reported use.<br/><br/>Value calculated under recorded terms.<br/><br/>Climate benefit remains unknown until disposal, destination, transport and weight basis are validated.',57,293,244,12)
para('1% of the RMIT estimate = 750 tonnes/year. Illustrative scale only; not achieved diversion or a forecast.',57,151,244,10,MUTED)
box(340,91,280,254,WHITE)
para('<b>Proposed pilot</b>',357,328,244,17,GREEN)
para('Start with a small group of cafes and accepting processors.<br/><br/>Validate actual requirements, quotes, disposal routes and pickup logistics.<br/><br/>Track repeat participation, collection failures, accepted quantities, reported use and real costs.',357,293,244,12)
para('Target: prove adoption and a change of material route before expanding.',357,140,244,10,MUTED)
box(640,91,280,254,WHITE)
para('<b>Tools + AI disclosure</b>',657,328,244,17,GREEN)
para('OpenAI Codex: planning, research, writing, coding and test development.<br/><br/>Next.js, React, TypeScript, Tailwind, Zod, Radix/CVA, Recharts, Lucide, SQLite, OpenAI SDK.<br/><br/>Vitest, Playwright, PGlite, ESLint, Prettier, agent-browser. GitHub and Notion. PDF: ReportLab, pypdf, pypdfium2.<br/><br/>Supabase: prepared only.',657,293,244,10.5)
para('Source code and full disclosure: github.com/advita04/Nile (implementation: codex/nile-initial-build)',40,72,880,10,GREEN)
c.linkURL('https://github.com/advita04/Nile/tree/codex/nile-initial-build',(40,51,916,77),relative=0)
para('Research: Climate Hack-tion brief and RMIT (2023). App scenario sources and boundaries: docs/climate-scenario.md.',40,51,880,8.5,MUTED)
end()
c.save()
print(OUT)
