import bpy,sys,os,math
AQ=os.path.dirname(os.path.abspath(__file__));sys.path.insert(0,AQ)
import kit,esculpe
from kit import q
from mathutils import Vector as V,Quaternion
args=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
MODO=args[0] if args else "prova";QUAIS=args[1].split(",") if len(args)>1 else None
G=-.845
bpy.ops.wm.read_factory_settings(use_empty=True)
B=kit.constroi();esculpe.aplica(B,1.7)
sc=bpy.context.scene;sc.render.engine="CYCLES";sc.cycles.use_denoising=True;sc.view_settings.view_transform="Standard";sc.render.film_transparent=False
sc.cycles.samples=8 if MODO=="prova" else 16;sc.render.resolution_x=sc.render.resolution_y=280 if MODO=="prova" else 400
sc.cycles.max_bounces=4
w=bpy.data.worlds.new("w");sc.world=w;w.use_nodes=True;n=w.node_tree.nodes["Background"];n.inputs[0].default_value=(1,1,1,1);n.inputs[1].default_value=1.0
def luz(e,rx,rz):
    l=bpy.data.lights.new("s","SUN");l.energy=e;l.angle=math.radians(14);o=bpy.data.objects.new("s",l);sc.collection.objects.link(o);o.rotation_euler=(math.radians(rx),0,math.radians(rz));return o
L1=luz(1.7,62,-40);L2=luz(.25,70,70);L3=luz(.65,65,175);L1.data.angle=math.radians(30);L2.data.use_shadow=False;L3.data.use_shadow=False
cam=bpy.data.cameras.new("c");co=bpy.data.objects.new("c",cam);sc.collection.objects.link(co);sc.camera=co;cam.lens=85
# ---- materiais ----
def mat(nome,cor,rug=.45,met=0):
    m=bpy.data.materials.new(nome);m.use_nodes=True;b=m.node_tree.nodes["Principled BSDF"];b.inputs["Base Color"].default_value=(*cor,1);b.inputs["Roughness"].default_value=rug;b.inputs["Metallic"].default_value=met;return m
ACO=mat("aco",(.8,.8,.82));ESC=mat("esc",(.22,.23,.25));PAD=mat("pad",(.3,.31,.33));CLA=mat("cla",(.93,.93,.94));CABO=mat("cabo",(.05,.05,.06))
EST=[];DIN=[]
kit.CINZA=(.97,.97,.97);kit.VERM=(.85,.035,.02);kit.PRETO=(.16,.17,.19)
LUZ=V((-.55,-.6,.75)).normalized()
def toon(m,fonte=None,cor=None,ao=True):
    nt=m.node_tree;saida=nt.nodes["Material Output"]
    geo=nt.nodes.new("ShaderNodeNewGeometry");dot=nt.nodes.new("ShaderNodeVectorMath");dot.operation="DOT_PRODUCT";dot.inputs[1].default_value=LUZ
    nt.links.new(geo.outputs["Normal"],dot.inputs[0])
    rp=nt.nodes.new("ShaderNodeValToRGB");rp.color_ramp.interpolation="CONSTANT";rp.color_ramp.elements[0].color=(.70,.70,.72,1);rp.color_ramp.elements[1].position=.05;rp.color_ramp.elements[1].color=(1,1,1,1)
    nt.links.new(dot.outputs["Value"],rp.inputs[0])
    mix=nt.nodes.new("ShaderNodeMixRGB");mix.blend_type="MULTIPLY";mix.inputs[0].default_value=1
    if fonte:nt.links.new(fonte,mix.inputs[1])
    else:mix.inputs[1].default_value=(*cor,1)
    nt.links.new(rp.outputs["Color"],mix.inputs[2]);ult=mix.outputs["Color"]
    if ao:
        a=nt.nodes.new("ShaderNodeAmbientOcclusion");a.samples=8;a.inputs["Distance"].default_value=.022
        r2=nt.nodes.new("ShaderNodeValToRGB");r2.color_ramp.interpolation="CONSTANT";r2.color_ramp.elements[0].color=(.10,.10,.11,1);r2.color_ramp.elements[1].position=.60;r2.color_ramp.elements[1].color=(1,1,1,1)
        nt.links.new(a.outputs["AO"],r2.inputs[0])
        m2=nt.nodes.new("ShaderNodeMixRGB");m2.blend_type="MULTIPLY";m2.inputs[0].default_value=1;nt.links.new(ult,m2.inputs[1]);nt.links.new(r2.outputs["Color"],m2.inputs[2]);ult=m2.outputs["Color"]
    em=nt.nodes.new("ShaderNodeEmission");nt.links.new(ult,em.inputs["Color"]);nt.links.new(em.outputs[0],saida.inputs["Surface"])
sc.render.use_freestyle=True;sc.render.line_thickness_mode="ABSOLUTE";sc.render.line_thickness=1.0
vl=sc.view_layers[0];vl.use_freestyle=True;fs=vl.freestyle_settings;fs.crease_angle=math.radians(118)
ls=fs.linesets[0] if len(fs.linesets) else fs.linesets.new("t");ls.select_silhouette=True;ls.select_border=True;ls.select_crease=True;ls.select_contour=True;ls.select_material_boundary=False
ls.linestyle=ls.linestyle or bpy.data.linestyles.new("t");ls.linestyle.color=(.02,.02,.025);ls.linestyle.thickness=2.6 if MODO!="prova" else 2.0
def chao2():pass
for _m,_c in ((ACO,(.8,.8,.82)),(ESC,(.22,.23,.25)),(PAD,(.3,.31,.33)),(CLA,(.93,.93,.94)),(CABO,(.05,.05,.06))):toon(_m,cor=_c,ao=False)
def chao():
    pass
def _reg(o,din):(DIN if din else EST).append(o)
def cil(a,b,r,m=ACO,din=False,tampa=True):
    a,b=V(a),V(b);d=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_mode="QUATERNION";o.rotation_quaternion=d.to_track_quat("Z","Y");o.data.materials.append(m);bpy.ops.object.shade_smooth();_reg(o,din);return o
def caixa(c,t,m=ACO,din=False,rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=c);o=bpy.context.object;o.scale=t
    if rot:o.rotation_mode="QUATERNION";o.rotation_quaternion=rot
    o.data.materials.append(m);bev=o.modifiers.new("b","BEVEL");bev.width=.012;bev.segments=2;_reg(o,din);return o
def tubo(a,b,l=.05,m=ACO,din=False):
    a,b=V(a),V(b);d=b-a;c=(a+b)/2;return caixa(c,(l,l,d.length),m,din,d.to_track_quat("Z","Y"))
def halter(c,ax,din=True):
    c=V(c);ax=V(ax).normalized();cil(c-ax*.09,c+ax*.09,.016,ACO,din)
    for s in (-1,1):
        cil(c+ax*s*.075,c+ax*s*.135,.052,ESC,din)
def limpa(l):
    for o in l:bpy.data.objects.remove(o,do_unlink=True)
    l.clear()
def base_pe(P,x=.13,y=0):
    for l,s in (("L",1),("R",-1)):
        P.alvos[("pe",l)]=(V((s*x,y,G+.095)),V((s*.08,-1,0)));P.pe[l]=V((s*.12,-1,-.42))
def mao(P,l):
    p=P.M["wrist."+l];return p.translation.copy()
def dirbr(P,l):return (P.M["wrist."+l].translation-P.M["lowerarm02."+l].translation).normalized()
def lerp(a,b,t):return V(a)*(1-t)+V(b)*t
# ---- exercicios: (musculos, camera(azim,elev,alvoZ,dist), estatico(), quadro(P,t)) ----
EX={}
def rosca_e():chao()
def rosca(P,t):
    base_pe(P)
    for l,s in (("L",1),("R",-1)):
        hd=lerp((s*.235,-.04,.06),(s*.235,-.235,.47),t)
        P.alvos[("mao",l)]=(hd,V((s*.1,1,-1)));P.tw[("mao",l)]=s*(-50)
    P.delta["spine05"]=q((1,0,0),-1.5*t);P.resolve()
    for l in"LR":
        c=mao(P,l);f=dirbr(P,l);h=c+f*.075;ax=f.cross(V((1,0,0)));halter(h,ax)
EX["rosca-martelo"]=(["biceps"],(22,6,-.02,4.7),rosca_e,rosca)
def lat(P,t):
    base_pe(P)
    for l,s in (("L",1),("R",-1)):
        hd=lerp((s*.3,-.08,.09),(s*.73,-.06,.53),t)
        P.alvos[("mao",l)]=(hd,V((s*.1,.3,-1)));P.tw[("mao",l)]=s*(-70)
        P.delta["clavicle."+l]=q((0,1,0),-s*6*t)
    P.resolve()
    for l in"LR":
        c=mao(P,l);f=dirbr(P,l);halter(c+f*.075,V((0,1,.0)))
EX["elevacao-lateral"]=(["ombro"],(12,8,-.02,4.8),rosca_e,lat)
def pul_e():
    chao();caixa((0,-.68,G+1.0),(.3,.12,2.0),CLA);caixa((0,-.75,G+.42),(.2,.03,.72),ESC)
    tubo((0,-.66,G+2.0),(0,-.42,G+2.0),.07);cil((0,-.42-.03,G+1.92),(0,-.42+.03,G+1.92),.045,ESC)
def pushdown(P,t):
    P.loc=V((0,.05,0));base_pe(P,.13,.05);P.delta["spine05"]=q((1,0,0),6)
    y=-.24
    for l,s in (("L",1),("R",-1)):
        hd=lerp((s*.1,-.42,.5),(s*.1,-.235,.09),t)
        P.alvos[("mao",l)]=(hd,V((s*.25,1,-.2)));P.tw[("mao",l)]=s*(-30);P.punho[l]=lerp((0,-.75,-.3),(0,-.3,-.9),t)
    P.resolve()
    a=mao(P,"L");b=mao(P,"R");dl=dirbr(P,"L");m=(a+b)/2+V(P.punho["L"]).normalized()*.08
    tubo(V(m)+V((.15,0,0)),V(m)-V((.15,0,0)),.024,ACO,True);cil(m,(0,-.42,G+1.92),.006,CABO,True)
EX["triceps-pulley"]=(["triceps"],(122,6,.1,5.2),pul_e,pushdown)
HIP=V((0,.2,G+.42))
def lp_e():
    chao()
    caixa((0,.42,G+.52),(.5,.08,.82),PAD,False,q((1,0,0),-52));caixa((0,.17,G+.29),(.5,.5,.08),PAD)
    caixa((0,.2,G+.12),(.4,.5,.24),ACO)
    for x in(-.2,.2):tubo((x,.05,G+.05),(x,-.95,G+1.05),.05)
    caixa((0,-.42,G+.03),(.52,1.0,.06),ACO)
def lp(P,t):
    P.loc=HIP-V((0,0,.1));P.base=q((1,0,0),-52);P.delta["neck01"]=q((1,0,0),24)
    d=lerp((0,0,0),(0,0,0),t);k=.42+.42*t
    uv=V((0,-.707,.707))
    for l,s in (("L",1),("R",-1)):
        a=HIP+uv*(k+.0)+V((s*.15,0,.06))
        P.alvos[("pe",l)]=(a,V((s*.22,.7,.7)));P.pe[l]=V((s*.06,-.47,.97))
        P.alvos[("mao",l)]=(HIP+V((s*.36,.06,.1)),V((s*.8,.3,.1)));P.tw[("mao",l)]=s*-20
    P.resolve()
    c=HIP+uv*(k+.0)+V((0,0,.06))+V((0,.707,.707))*.09+uv*.075
    caixa(c,(.56,.46,.04),ESC,True,uv.to_track_quat("Z","Y"))
    for s in(-1,1):
        cil(c+uv*.08+V((s*.3,0,0)),c+uv*.08+V((s*.36,0,0)),.12,ESC,True);cil(c+V((s*.2,0,0))+uv*.08,c+V((s*.42,0,0))+uv*.08,.02,ACO,True)
EX["leg-press-45"]=(["quadriceps","gluteo"],(70,10,-.22,5.0),lp_e,lp)
ZS=G+.5
def pd_e():
    chao();caixa((0,.1,ZS-.04),(.42,.42,.07),PAD);caixa((0,.1,G+.22),(.16,.16,.44),ACO)
    caixa((0,-.62,G+1.15),(.14,.14,2.3));tubo((0,-.62,G+2.28),(0,-.22,G+2.28),.09);cil((0,-.22-.03,G+2.22),(0,-.22+.03,G+2.22),.05,ESC)
    tubo((0,-.42,G+.75),(0,-.62,G+.75),.05);caixa((0,-.34,G+.73),(.42,.09,.09),PAD)
    caixa((0,-.5,G+.05),(.5,.7,.1))
def pd(P,t):
    P.loc=V((0,.1,ZS+.125-.115));P.base=q((1,0,0),-10*t-2)
    for l,s in (("L",1),("R",-1)):
        P.alvos[("pe",l)]=(V((s*.15,-.42,G+.17)),V((s*.08,-1,.2)));P.pe[l]=V((s*.08,-1,-.38))
        S=V((s*.19,.14,ZS+.68))
        hd=lerp((s*.035,-.18,ZS+1.27),(s*.04,-.19,ZS+.72),t)
        P.alvos[("mao",l)]=(hd,V((s*.75,.45,lerp((0,0,.25),(0,0,-.75),t).z)));P.tw[("mao",l)]=s*40
        P.delta["clavicle."+l]=q((0,1,0),-s*14*(1-t))
    P.resolve()
    a,b=mao("x" and P,"L"),mao(P,"R");m=(a+b)/2+V((0,0,.06))
    tubo(a+V((0,0,.05)),b+V((0,0,.05)),.022,ACO,True);tubo(m,m+V((0,0,.1)),.022,ACO,True)
    cil(m+V((0,0,.1)),(0,-.22,G+2.22),.006,CABO,True)
EX["puxada-neutra"]=(["dorsal"],(205,9,.22,5.3),pd_e,pd)
ZC=G+.46
def cal_e():
    chao();caixa((0,.18,ZC-.04),(.42,.5,.07),PAD);caixa((0,.2,G+.2),(.2,.2,.4),ACO)
    caixa((0,-.5,G+.06),(.5,.24,.12),ESC);tubo((-.28,.2,G+.05),(-.28,-.5,G+.05),.05)
    tubo((-.3,-.05,G+.05),(-.3,-.28,ZC+.1),.05)
def cal(P,t):
    P.loc=V((0,.2,ZC+.125-.115));P.delta["spine05"]=q((1,0,0),4)
    az=G+.135+.075*t
    for l,s in (("L",1),("R",-1)):
        P.alvos[("pe",l)]=(V((s*.14,-.42,az)),V((s*.05,-1,.4)));P.pe[l]=lerp((s*.05,-.85,.38),(s*.05,-.8,-.55),t)
        P.alvos[("mao",l)]=(V((s*.19,-.2,ZC+.2+.03*t)),V((s*.7,.5,-.5)));P.tw[("mao",l)]=s*-50
    P.resolve()
    ax=(P.M["lowerleg01.L"].translation+P.M["lowerleg01.R"].translation)/2
    caixa(ax+V((0,.1,.08)),(.46,.2,.07),PAD,True)
    for l,s in (("L",1),("R",-1)):pass
    tubo(ax+V((-.3,.1,.08)),(-.3,-.28,ZC+.1),.03,ACO,True)
EX["panturrilha-sentado"]=(["panturrilha"],(116,6,-.2,4.7),cal_e,cal)
exec(open(AQ+"/exs.py",encoding="utf8").read())
def camera(az,el,z,d):
    a=math.radians(az);e=math.radians(el);co.location=(d*math.sin(a)*math.cos(e),-d*math.cos(a)*math.cos(e),z+d*math.sin(e))
    co.rotation_euler=(V((0,0,z))-co.location).to_track_quat("-Z","Y").to_euler()
OUT=AQ+"/saida/"+MODO+"/";os.makedirs(OUT,exist_ok=True)
for nome,(mus,cm,est,qd) in EX.items():
    if QUAIS and nome not in QUAIS:continue
    kit.SO="L" if nome in {"triceps-polia-unilateral","elevacao-lateral-polia","posterior-polia-baixa","remada-serrote","cadeira-extensora-unilateral","flexora-em-pe"} else None
    kit.pinta(B,mus);limpa(EST);est();camera(*cm)
    pele=bpy.data.materials["pele"]
    if "tn" not in pele:
        pele["tn"]=1;nt=pele.node_tree;sp=nt.nodes.new("ShaderNodeSeparateColor");nt.links.new(nt.nodes["Attribute"].outputs["Color"],sp.inputs[0])
        def corte(saida,lim):
            r=nt.nodes.new("ShaderNodeValToRGB");r.color_ramp.interpolation="CONSTANT";r.color_ramp.elements[1].position=lim;nt.links.new(saida,r.inputs[0]);return r.outputs["Color"]
        a=nt.nodes.new("ShaderNodeMixRGB");nt.links.new(corte(sp.outputs[0],.42),a.inputs[0]);a.inputs[1].default_value=(*kit.CINZA,1);a.inputs[2].default_value=(*kit.VERM,1)
        b=nt.nodes.new("ShaderNodeMixRGB");nt.links.new(corte(sp.outputs[1],.5),b.inputs[0]);nt.links.new(a.outputs[0],b.inputs[1]);b.inputs[2].default_value=(*kit.PRETO,1)
        toon(pele,fonte=b.outputs[0])
    ts=[0,1] if MODO=="prova" else [0,.15,.4,.65,.88,1]
    for k,t in enumerate(ts):
        if MODO!="prova" and os.path.exists(f"{OUT}{nome}-{k:02d}.png"):continue
        limpa(DIN);P=kit.Pose(B)
        try:qd(P,t)
        except Exception as e:
            import traceback;print("ERRO",nome,e);traceback.print_exc();break
        sc.render.filepath=f"{OUT}{nome}-{k:02d}.png";bpy.ops.render.render(write_still=True)
print("FIM")
