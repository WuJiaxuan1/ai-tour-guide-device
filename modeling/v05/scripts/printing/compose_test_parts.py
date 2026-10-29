from PIL import Image,ImageFont,ImageDraw
from pathlib import Path
O=Path(r'C:/Users/Macaroon/.codex/.chatgpt-projects/g-p-6aba0812d9c08191b8113a7e66f4ee79/output/printing-guide')
im=Image.new('RGB',(1200,1170),'white');d=ImageDraw.Draw(im)
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
d.text((30,20),'预打印：两边都打印，再验证能否配合',font=font(35),fill='#172B3A')
d.text((30,75),'蓝色 = 主体上的配合结构；金色 = 带卡扣的前圈结构',font=font(24),fill='#456072')
for row,(title,left,right,ll,rr,note) in enumerate([
 ('第一轮：只测试局部扣合','01_socket','02_clip','主体上的一小段卡槽','前圈上的一小段弹性卡扣','同一个卡槽，依次试 0.2 / 0.3 / 0.4 mm 三档；图中只展示一档。'),
 ('第二轮：测试整个 StopWatch 装入','03_fixture','04_ring','简化主体：保留一整圈卡槽和承托位置','完整前圈：背面有两个一体卡扣','底座仅用于试装；前圈通过后可用于最终吉祥物。')]):
 y=130+row*500
 d.text((30,y),title,font=font(29),fill='#172B3A')
 for x,name,label in [(20,left,ll),(620,right,rr)]:
  pic=Image.open(O/(name+'.png')).convert('RGB');pic.thumbnail((560,365),Image.Resampling.LANCZOS)
  im.paste(pic,(x+(560-pic.width)//2,y+50));d.text((x+10,y+425),label,font=font(23),fill='#172B3A')
 d.text((30,y+465),note,font=font(21),fill='#456072')
im.save(O/'test-print-explained.png')
print(O/'test-print-explained.png')
