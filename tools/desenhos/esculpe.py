# Definicao muscular: empurra a pele para fora nos musculos e para dentro nos sulcos.
import math
from mathutils import Vector
import kit
def g(d):return math.exp(-d*d*1.6)
def el(p,c,r):return sum(((p[i]-c[i])/r[i])**2 for i in range(3))**.5
def lim(p,A,C):
    d=C-A;L=d.length;u=d/L;t=(p-A).dot(u)/L;r=p-(A+u*(t*L));return t,r,u
def ang(r,u,fr):
    f=(fr-u*fr.dot(u)).normalized()
    if r.length<1e-6:return 0
    return math.degrees(math.acos(max(-1,min(1,r.normalized().dot(f)))))
def lobo(t,th,t0,t1,th0,dth):
    # bolha alongada no membro
    tc=(t0+t1)/2;tr=(t1-t0)/2;return g(((t-tc)/tr)**2**.5 if False else (t-tc)/tr)*g((th-th0)/dth)
def aplica(B,escala=1.0):
    me=B.ob.data;me.update();N=[v.normal.copy() for v in me.vertices];desl=[0.0]*len(N)
    R=B.resto;zc=R["spine01"].translation.z
    for i,p0 in enumerate(B.verts):
        p=Vector((abs(p0.x),p0.y,p0.z));d=0;lado="L"
        T=lambda n:R[n+".L"].translation
        ga,co,pu,qu,jo,to=T("upperarm01"),T("lowerarm01"),T("wrist"),T("upperleg01"),T("lowerleg01"),T("foot")
        cx=ga.x;zq=qu.z;H=zc-zq
        pb=kit.peso(B,i,kit.BRACO);pa=kit.peso(B,i,kit.ANTE);pc=kit.peso(B,i,kit.COXA);pn=kit.peso(B,i,kit.CANELA);pt=kit.peso(B,i,kit.TRONCO|{"neck01","neck02","neck03"})
        fora=Vector((1,0,0))
        if pt>.35:
            fr=p.y<0
            if fr:
                # peito
                e=el(p,(cx*.5,-.1,zc+.035),(cx*.58,1,.082));d+=.016*g(e)*pt
                d-=.012*math.exp(-(p.x/.012)**2)*(1 if p.z>zq+H*.05 else 0)            # linha central
                d-=.007*math.exp(-((p.z-(zc-.055-.0*p.x))/.013)**2)*(1 if p.x<cx*.95 else 0)  # sob o peito
                # abdomen em gomos
                if p.x<cx*.5 and zq+H*.12<p.z<zc-.06:
                    for k in (.28,.5,.72):d-=.006*math.exp(-((p.z-(zq+H*k))/.009)**2)
                    d+=.006
                d-=.006*math.exp(-((p.x-cx*.52)/.012)**2)*(1 if zq+H*.1<p.z<zc-.05 else 0)  # lateral do abdomen
                d+=.006*g(el(p,(cx*.7,-.07,zq+H*.5),(cx*.2,1,H*.28)))                      # obliquos/serrátil
            else:
                d+=.013*g(el(p,(cx*.62,.1,zq+H*.62),(cx*.42,1,H*.34)))*pt    # dorsal
                d+=.012*g(el(p,(cx*.24,.08,zc+.1),(cx*.36,1,.12)))*pt        # trapezio
                d+=.009*g(el(p,(cx*.6,.1,zc+.03),(cx*.28,1,.06)))*pt         # escapula
                d-=.008*math.exp(-(p.x/.012)**2)                             # coluna
                d+=.008*g(el(p,(.04,.09,zq+H*.32),(.035,1,H*.3)))            # lombar
        # ombro
        e=el(p,ga+Vector((.02,0,.012)),(.09,.095,.11));d+=.016*g(e)*min(1,(pb+pt*.3))
        if pb>.35:
            t,r,u=lim(p,ga,co);th=ang(r,u,kit.FRENTE+fora*.15)
            d+=.018*g((t-.55)/.3)*g(th/55)*pb                     # biceps
            th2=ang(r,u,kit.TRAS+fora*.2)
            d+=.016*g((t-.5)/.34)*g(th2/62)*pb                    # triceps
            d-=.006*math.exp(-((th-82)/10)**2)*(1 if .3<t<.95 else 0)*pb
        if pa>.35:
            t,r,u=lim(p,co,pu);th=ang(r,u,kit.FRENTE)
            d+=.010*g((t-.28)/.3)*pa
            d-=.003*math.exp(-((th-90)/10)**2)*(1 if t<.6 else 0)*pa
        if pc>.35:
            t,r,u=lim(p,qu,jo);th=ang(r,u,kit.FRENTE+fora*.1)
            d+=.016*g((t-.55)/.32)*g((th-0)/32)*pc                # reto femoral
            sg=r.dot(fora)
            d+=.014*g((t-.62)/.3)*g((th-60)/25)*pc*(1 if sg>0 else .85)   # vastos
            d-=.006*math.exp(-((th-32)/7)**2)*(1 if .2<t<.9 else 0)*pc
            th2=ang(r,u,kit.TRAS)
            d+=.014*g((t-.55)/.3)*g(th2/55)*pc                    # posterior
            d-=.004*math.exp(-(th2/7)**2)*(1 if .3<t<.9 else 0)*pc
        if pn>.35:
            t,r,u=lim(p,jo,to);th=ang(r,u,kit.TRAS)
            d+=.020*g((t-.28)/.2)*g(th/62)*pn                     # panturrilha
            d-=.005*math.exp(-(th/7)**2)*(1 if .1<t<.5 else 0)*pn
            d+=.006*g((t-.3)/.3)*g((ang(r,u,kit.FRENTE))/35)*pn   # tibial
        e=el(p,(.09,.1,zq-.015),(.12,.13,.11));d+=.016*g(e)*(1 if p.y>0 else 0)   # gluteo
        desl[i]=d*escala
    # suaviza 2x pela malha para nao marcar degraus
    viz=[[] for _ in N]
    for e in me.edges:viz[e.vertices[0]].append(e.vertices[1]);viz[e.vertices[1]].append(e.vertices[0])
    for _ in range(2):
        desl=[.6*desl[i]+.4*(sum(desl[j] for j in viz[i])/max(1,len(viz[i]))) for i in range(len(N))]
    for i,v in enumerate(me.vertices):v.co=v.co+N[i]*desl[i]
    me.update()
