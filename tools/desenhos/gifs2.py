import sys,glob,os;A=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,A+'/../py')
from PIL import Image,ImageDraw
d=A+"/saida/final/";G=A+"/gifs/";os.makedirs(G,exist_ok=True)
for f in glob.glob(G+"*.gif"):os.remove(f)
TAM=320;CORES=64
nomes=sorted({os.path.basename(f).rsplit("-",1)[0] for f in glob.glob(d+"*.png")})
def le(n):
    r=[]
    for f in sorted(glob.glob(d+n+"-[0-9][0-9].png")):
        i=Image.open(f).convert("RGBA");b=Image.new("RGBA",i.size,"white");b.alpha_composite(i);r.append(b.convert("RGB").resize((TAM,TAM),Image.LANCZOS))
    return r
def seq(l):return [l[0]]*3+l[1:-1]+[l[-1]]*3+l[-2:0:-1]
tot=0;fol=[]
for n in nomes:
    l=le(n);s=seq(l)
    # paleta: tres quadros do exercicio + uma faixa de vermelhos, para o vermelho nunca ser descartado
    m=Image.new("RGB",(TAM*3,TAM+TAM//2),"white")
    for k,i in enumerate((0,len(l)//2,len(l)-1)):m.paste(l[i],(k*TAM,0))
    fx=ImageDraw.Draw(m)
    for x in range(TAM*3):
        u=x/(TAM*3-1);fx.line([(x,TAM),(x,TAM+TAM//2)],fill=(int(150+u*95),int(28+u*27),int(20+u*22)))
    pal=m.quantize(colors=CORES,dither=Image.Dither.NONE)
    q=[x.quantize(palette=pal,dither=Image.Dither.NONE) for x in s]
    p=f"{G}{n}.gif";q[0].save(p,save_all=True,append_images=q[1:],duration=110,loop=0,optimize=True)
    tot+=os.path.getsize(p);fol.append((n,l[0],l[-1]))
print(len(nomes),"gifs",tot//1024,"KB total",tot//1024//len(nomes),"KB media")
# folhas de conferencia: inicio e fim de cada exercicio
S=150;C=8;P=32;F=[]
for p in range(0,len(fol),P):
    sub=fol[p:p+P];L=(len(sub)+C//2-1)//(C//2);o=Image.new("RGB",(C*S,L*(S+12)),"white");dr=ImageDraw.Draw(o)
    for k,(n,a,b) in enumerate(sub):
        x=(k%(C//2))*2*S;y=(k//(C//2))*(S+12);o.paste(a.resize((S,S),Image.LANCZOS),(x,y+12));o.paste(b.resize((S,S),Image.LANCZOS),(x+S,y+12));dr.text((x+2,y),n,fill=(200,0,0))
    nm=f"{A}/fin{p//P}.png";o.save(nm);F.append(nm)
cheque=["prancha","flexao","rosca-martelo","elevacao-lateral","barra-fixa","cadeira-extensora","rosca-barra","rosca-scott","panturrilha-leg-press","remada-curvada-barra","triceps-barra-reta"]
o=Image.new("RGB",(4*2*190,3*202),"white");dr=ImageDraw.Draw(o);fd=dict((x[0],x) for x in fol)
for k,n in enumerate(cheque):
    x=(k%4)*380;y=(k//4)*202;o.paste(fd[n][1].resize((190,190),Image.LANCZOS),(x,y+12));o.paste(fd[n][2].resize((190,190),Image.LANCZOS),(x+190,y+12));dr.text((x+2,y),n,fill=(200,0,0))
o.save(A+"/chk.png")
import collections
print({n:len(glob.glob(d+n+"-[0-9][0-9].png")) for n in nomes if len(glob.glob(d+n+"-[0-9][0-9].png"))!=6})
