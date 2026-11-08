# Boneco 3D proprio: corpo MakeHuman (CC0), esqueleto, musculos coloridos e poses.
import bpy,json,math,os
from mathutils import Vector,Quaternion,Matrix
AQUI=os.path.dirname(os.path.abspath(__file__));MH=AQUI+"/mh/"
def conv(v):return Vector((v[0]*.1,-v[2]*.1,v[1]*.1))
def carrega_obj():
    V=[];F=[];g=None
    for l in open(MH+"base.obj",encoding="utf8"):
        if l.startswith("v "):V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith("g "):g=l.split()[1]
        elif l.startswith("f ") and g=="body":F.append([int(p.split("/")[0])-1 for p in l.split()[1:]])
    return V,F
def alvo(V,arq,peso):
    for l in open(MH+arq,encoding="utf8"):
        if l[0]=="#" or not l.strip():continue
        p=l.split();i=int(p[0]);V[i][0]+=float(p[1])*peso;V[i][1]+=float(p[2])*peso;V[i][2]+=float(p[3])*peso
class Boneco:pass
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def constroi():
    B=Boneco();V,F=carrega_obj()
    alvo(V,"caucasian-male-young.target",1.0);alvo(V,"universal-male-young-maxmuscle-averageweight.target",1.1)
    sk=json.load(open(MH+"default.mhskel",encoding="utf8"));J=sk["joints"]
    pos={k:sum((conv(V[i]) for i in idx),Vector())/len(idx) for k,idx in J.items()}
    usados=sorted({i for f in F for i in f});mapa={o:n for n,o in enumerate(usados)}
    verts=[conv(V[i]) for i in usados];faces=[[mapa[i] for i in f] for f in F]
    me=bpy.data.meshes.new("corpo");me.from_pydata(verts,[],faces);me.update()
    for p in me.polygons:p.use_smooth=True
    ob=bpy.data.objects.new("corpo",me);bpy.context.scene.collection.objects.link(ob)
    arm=bpy.data.armatures.new("esq");ao=bpy.data.objects.new("esq",arm);bpy.context.scene.collection.objects.link(ao)
    bpy.context.view_layer.objects.active=ao;bpy.ops.object.mode_set(mode="EDIT")
    for n,b in sk["bones"].items():
        e=arm.edit_bones.new(n);e.head=pos[b["head"]];e.tail=pos[b["tail"]]
        if (e.tail-e.head).length<1e-4:e.tail=e.head+Vector((0,0,.01))
    for n,b in sk["bones"].items():
        if b["parent"]:arm.edit_bones[n].parent=arm.edit_bones[b["parent"]];arm.edit_bones[n].use_connect=False
    bpy.ops.object.mode_set(mode="OBJECT")
    W=json.load(open(MH+"default_weights.mhw",encoding="utf8"))["weights"]
    pv={}
    for n,l in W.items():
        g=ob.vertex_groups.new(name=n)
        for i,w in l:
            if i in mapa:g.add([mapa[i]],w,"REPLACE");pv.setdefault(mapa[i],{})[n]=w
    m=ob.modifiers.new("arm","ARMATURE");m.object=ao
    s=ob.modifiers.new("sub","SUBSURF");s.levels=1;s.render_levels=1
    B.ob=ob;B.ao=ao;B.pos=pos;B.pv=pv;B.verts=verts;B.sk=sk;B.ordem=[]
    def add(n):
        if n in B.ordem:return
        p=sk["bones"][n]["parent"]
        if p:add(p)
        B.ordem.append(n)
    for n in sk["bones"]:add(n)
    B.resto={b.name:b.matrix_local.copy() for b in arm.bones}
    return B
def faixa(p,A,C,t0,t1,frente,ang,larg=.08):
    d=C-A;L=d.length;u=d/L;t=(p-A).dot(u)/L;r=p-(A+u*(t*L))
    if r.length<1e-5:return 0
    fr=(frente-u*frente.dot(u)).normalized();c=max(-1,min(1,r.normalized().dot(fr)));th=math.degrees(math.acos(c))
    return smooth(t0-larg,t0+larg,t)*(1-smooth(t1-larg,t1+larg,t))*(1-smooth(ang*.7,ang*1.15,th))
def elip(p,c,r):
    d=sum(((p[i]-c[i])/r[i])**2 for i in range(3))**.5;return 1-smooth(.75,1.05,d)
def peso(B,i,nomes):
    return sum(w for n,w in B.pv.get(i,{}).items() if n.split(".")[0] in nomes)
BRACO={"upperarm01","upperarm02","shoulder01"};ANTE={"lowerarm01","lowerarm02"};COXA={"upperleg01","upperleg02"};CANELA={"lowerleg01","lowerleg02"}
TRONCO={"spine01","spine02","spine03","spine04","spine05","clavicle","pelvis","root","breast"}
FRENTE=Vector((0,-1,0));TRAS=Vector((0,1,0))
def mascara(B,mus,i,p):
    v=0
    for lado,sg in (("L",1),("R",-1)):
        if (p.x*sg)<-.005:continue
        if SO and lado!=SO:continue
        T=lambda n:B.resto[n+"."+lado].translation
        ga,co,pu,qu,jo,to=T("upperarm01"),T("lowerarm01"),T("wrist"),T("upperleg01"),T("lowerleg01"),T("foot")
        fora=Vector((sg,0,0));z=B.resto["spine01"].translation.z;zq=qu.z;H=z-zq;cx=abs(ga.x)
        if mus=="triceps":v=max(v,faixa(p,ga,co,.2,.93,TRAS+fora*.2,68)*min(1,peso(B,i,BRACO)*1.6))
        if mus=="biceps":v=max(v,faixa(p,ga,co,.27,.84,FRENTE+fora*.05,48)*min(1,peso(B,i,BRACO)*1.6))
        if mus=="antebraco":v=max(v,faixa(p,co,pu,.02,.65,FRENTE,110)*min(1,peso(B,i,ANTE)*1.6))
        if mus=="ombro":v=max(v,elip(p,ga+Vector((sg*.02,0,.01)),(.085,.085,.115))*min(1,peso(B,i,BRACO|{"clavicle"})*1.6))
        if mus=="ombro_post":v=max(v,elip(p,ga+Vector((sg*.012,.05,.012)),(.08,.07,.1))*min(1,peso(B,i,BRACO|{"clavicle"})*1.6)*(1 if p.y>-.01 else 0))
        if mus=="lombar":v=max(v,elip(p,(sg*.05,.09,zq+H*.3),(.075,.1,H*.33))*(1 if p.y>0 else 0))
        if mus=="peito":v=max(v,elip(p,(sg*cx*.48,-.11,z+.02),(cx*.55,.14,.085))*(1 if p.y<-.02 else 0)*min(1,peso(B,i,TRONCO)*1.4))
        if mus=="dorsal":v=max(v,elip(p,(sg*cx*.62,.07,zq+H*.62),(cx*.55,.14,H*.42))*(1 if p.y>-.02 else 0)*min(1,peso(B,i,TRONCO)*1.4))
        if mus=="trapezio":v=max(v,elip(p,(sg*cx*.3,.09,z+.04),(cx*.33,.12,.1))*(1 if p.y>0 else 0)*min(1,peso(B,i,TRONCO|{"neck01","neck02","neck03"})*1.4))
        if mus=="abdomen":v=max(v,elip(p,(0,-.1,zq+H*.45),(cx*.42,.14,H*.5))*(1 if p.y<0 else 0))
        if mus=="gluteo":v=max(v,elip(p,(sg*.09,.09,zq-.01),(.12,.13,.11))*(1 if p.y>0 else 0))
        if mus=="quadriceps":v=max(v,faixa(p,qu,jo,.12,.92,FRENTE+fora*.15,85)*min(1,peso(B,i,COXA)*1.5))
        if mus=="posterior":v=max(v,faixa(p,qu,jo,.2,.92,TRAS,75)*min(1,peso(B,i,COXA)*1.5))
        if mus=="adutor":v=max(v,faixa(p,qu,jo,.05,.65,-fora,62)*min(1,peso(B,i,COXA)*1.5))
        if mus=="abdutor":v=max(v,elip(p,qu+Vector((sg*.06,.02,.03)),(.09,.1,.11)))
        if mus=="panturrilha":v=max(v,faixa(p,jo,to,.05,.62,TRAS,95)*min(1,peso(B,i,CANELA)*1.5))
    return v
SO=None
SOBRE={"gluteo","abdutor","adutor","lombar"}
CINZA=(.62,.62,.63);VERM=(.80,.075,.04);PRETO=(.035,.035,.04)
def pinta(B,musculos):
    me=B.ob.data
    if "cor" in me.color_attributes:me.color_attributes.remove(me.color_attributes["cor"])
    ca=me.color_attributes.new("cor","FLOAT_COLOR","POINT")
    qL=B.resto["upperleg01.L"].translation;jo=B.resto["lowerleg01.L"].translation;zq=qL.z
    zs=zq+.085;zi=zq-(zq-jo.z)*.46
    for i,p in enumerate(B.verts):
        m=0
        for mu in musculos:m=max(m,mascara(B,mu,i,p))
        sh=0
        if abs(p.x)<.3:sh=smooth(zi-.012,zi+.012,p.z)*(1-smooth(zs-.012,zs+.012,p.z))
        if sh>0 and any(mu in SOBRE and mascara(B,mu,i,p)>.3 for mu in musculos):sh=0
        ca.data[i].color=(m,sh,0,1)
    mat=bpy.data.materials.get("pele") or bpy.data.materials.new("pele");mat.use_nodes=True
    nt=mat.node_tree;bs=nt.nodes["Principled BSDF"];at=nt.nodes.get("Attribute") or nt.nodes.new("ShaderNodeAttribute");at.attribute_name="cor"
    nt.links.new(at.outputs["Color"],bs.inputs["Base Color"]);bs.inputs["Roughness"].default_value=.48;bs.inputs["Specular IOR Level"].default_value=.35
    if not me.materials:me.materials.append(mat)
def q(eixo,graus):return Quaternion(Vector(eixo).normalized(),math.radians(graus))
SEG={"mao":("upperarm01","upperarm02","lowerarm01","lowerarm02","wrist"),"pe":("upperleg01","upperleg02","lowerleg01","lowerleg02","foot")}
class Pose:
    """loc: deslocamento do quadril. base: rotacao do corpo. delta[osso]: giro extra.
    alvos[('mao'|'pe',lado)]=(ponto,polo). tw[(tipo,lado)]=giro do antebraco.
    punho[lado]=direcao da mao. pe[lado]=direcao do pe. dedos=angulo de fechar a mao."""
    def __init__(s,B):
        s.B=B;s.M={};s.base=Quaternion();s.loc=Vector();s.delta={};s.alvos={};s.tw={};s.punho={};s.pe={};s.dedos=62;s.dd={}
    def fk(s,n):
        B=s.B;R=B.resto[n];p=B.sk["bones"][n]["parent"]
        if p is None:M=Matrix.Translation(s.loc+R.translation)@s.base.to_matrix().to_4x4()@Matrix.Translation(-R.translation)@R
        else:M=s.M[p]@B.resto[p].inverted()@R
        d=s.delta.get(n)
        if d:
            h=M.translation.copy();M=Matrix.Translation(h)@d.to_matrix().to_4x4()@Matrix.Translation(-h)@M
        s.M[n]=M;return M
    def mira(s,n,d,tw=0):
        M=s.M[n];h=M.translation.copy();y=(M.to_3x3()@Vector((0,1,0))).normalized();d=Vector(d).normalized();Q=y.rotation_difference(d)
        if tw:Q=Quaternion(d,math.radians(tw))@Q
        s.M[n]=Matrix.Translation(h)@Q.to_matrix().to_4x4()@Matrix.Translation(-h)@M
    def resolve(s):
        B=s.B;plano={}
        for n in B.ordem:
            s.fk(n);b=n.split(".")[0];lado=n.split(".")[1] if "." in n else None
            if b in("upperarm01","upperleg01") and lado:
                t="mao" if b=="upperarm01" else "pe"
                if (t,lado) in s.alvos:plano[(t,lado)]=s._ik(n,t,lado)
            for t in ("mao","pe"):
                if lado and b in SEG[t][:4] and (t,lado) in plano:
                    d1,d2,tw=plano[(t,lado)]
                    if b==SEG[t][1]:s.mira(n,d1)
                    if b==SEG[t][2]:s.mira(n,d2,tw*.45)
                    if b==SEG[t][3]:s.mira(n,d2,tw*.55)
            if b=="wrist" and lado in s.punho:s.mira(n,s.punho[lado])
            if b=="foot" and lado in s.pe:s.mira(n,s.pe[lado])
            if b.startswith("finger") and lado:
                f=int(b[6]);j=int(b[8]);ang=s.dedos*(.55 if f==1 else 1)*(1 if j>1 or f>1 else .4)
                if ang:
                    R=B.resto;l=(R["finger5-1."+lado].translation-R["finger2-1."+lado].translation).normalized()
                    M=s.M[n];ax=(s.M["wrist."+lado].to_3x3()@R["wrist."+lado].to_3x3().inverted()@l).normalized()
                    sg=1 if lado=="L" else -1;h=M.translation.copy()
                    s.M[n]=Matrix.Translation(h)@Quaternion(ax,math.radians(ang*sg*s.dd.get("sinal",1))).to_matrix().to_4x4()@Matrix.Translation(-h)@M
        s.aplica()
    def _ik(s,n,t,lado):
        B=s.B;alvo,polo=s.alvos[(t,lado)];h=s.M[n].translation.copy();a,b,c=SEG[t][0],SEG[t][2],SEG[t][4]
        T=lambda x:B.resto[x+"."+lado].translation
        L1=(T(b)-T(a)).length;L2=(T(c)-T(b)).length
        d=Vector(alvo)-h;D=min(d.length,(L1+L2)*.998);u=d.normalized();A=(L1*L1+D*D-L2*L2)/(2*D);hh=max(0,L1*L1-A*A)**.5
        pv=Vector(polo);pv=pv-u*pv.dot(u);pv=pv.normalized() if pv.length>1e-5 else Vector((0,0,1))
        cot=h+u*A+pv*hh;d1=(cot-h).normalized();d2=(h+u*D-cot).normalized()
        s.mira(n,d1);return d1,d2,s.tw.get((t,lado),0)
    def aplica(s):
        B=s.B;po=B.ao.pose.bones
        for n in B.ordem:
            p=B.sk["bones"][n]["parent"];R=B.resto[n]
            b=((B.resto[p].inverted()@R).inverted()@s.M[p].inverted()@s.M[n]) if p else R.inverted()@s.M[n]
            po[n].rotation_mode="QUATERNION";po[n].matrix_basis=b
        bpy.context.view_layer.update()
    def ponto(s,n):return s.M[n].translation.copy()
