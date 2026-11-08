# Catalogo de exercicios: musculos, camera (azimute, elevacao, alvo Z, distancia), aparelho e movimento (t=0 inicio, t=1 contracao)
EX.clear()
LADOS=(("L",1),("R",-1))
_r=B.resto
ROOT=_r["root"].translation.copy()
HIPC=(_r["upperleg01.L"].translation+_r["upperleg01.R"].translation)/2
def Q(P,pt):return P.loc+ROOT+P.base@(V(pt)-ROOT)
def om(P,s):return Q(P,_r["upperarm01."+("L" if s>0 else "R")].translation)
def corpo(P,alvo,lean=0):
    P.base=q((1,0,0),lean);P.loc=V(alvo)-ROOT-P.base@(HIPC-ROOT)
def M_(P,s,hd,pol,tw=0,pu=None):
    l="L" if s>0 else "R";P.alvos[("mao",l)]=(V(hd),V(pol));P.tw[("mao",l)]=tw
    if pu is not None:P.punho[l]=V(pu)
def Pe(P,s,a,pol=(0,-1,0),d=None):
    l="L" if s>0 else "R";P.alvos[("pe",l)]=(V(a),V(pol));P.pe[l]=V(d if d is not None else (s*.12,-1,-.42))
def pes(P,y=0,x=.13,pol=None,d=None):
    for l,s in LADOS:Pe(P,s,(s*x,y,G+.095),pol or (s*.08,-1,0),d)
def sentado(P,y=0,zs=G+.48,lean=0,py=-.44,px=.16):
    corpo(P,(0,y,zs+.125),lean)
    for l,s in LADOS:Pe(P,s,(s*px,y+py,G+.095),(s*.06,-1,.2),(s*.08,-1,-.38))
TN=lambda s:s*-50     # pegada neutra
TS=lambda s:s*-125    # palmas para cima
TP=lambda s:s*25      # palmas para baixo
def fim(P,l):return P.M["wrist."+l].translation.copy()
def centro_mao(P,l,e=.075):return fim(P,l)+dirbr(P,l)*e
def barra(P,c=.6,an=.11,din=True,ax=(1,0,0)):
    m=(centro_mao(P,"L")+centro_mao(P,"R"))/2;a=V(ax).normalized()
    cil(m-a*c,m+a*c,.014,ACO,din)
    if an:
        for s in(-1,1):
            cil(m+a*s*(c-.14),m+a*s*(c-.09),an,ESC,din)
    return m
def halteres(P,ax=None):
    for l,s in LADOS:
        f=dirbr(P,l);h=centro_mao(P,l);a=V(ax) if ax else f.cross(V((1,0,0)))
        if a.length<.05:a=V((0,1,0))
        halter(h,a)
def banco(y,comp,z,larg=.32,pernas=True):
    caixa((0,y,z-.04),(larg,comp,.08),PAD)
    if pernas:caixa((0,y,(G+z-.08)/2),(.12,.12,z-.08-G))
def encosto(hip,lean,alt=.72,larg=.34,atras=.15):
    d=V((0,math.sin(math.radians(lean)),math.cos(math.radians(lean))));n=V((0,math.cos(math.radians(lean)),-math.sin(math.radians(lean))))
    caixa(V(hip)+n*atras+d*(alt/2-.08),(larg,.08,alt),PAD,False,q((1,0,0),-lean))
def coluna(x=0,y=-.68,dy=1,alt=2.0):
    caixa((x,y,G+alt/2),(.26,.12,alt),CLA);caixa((x,y-dy*.07,G+alt*.22),(.16,.03,alt*.36),ESC)
    alto=V((x,y+dy*.22,G+alt-.08));baixo=V((x,y+dy*.22,G+.12))
    tubo((x,y,G+alt),(x,y+dy*.22,G+alt),.06);tubo((x,y,G+.06),(x,y+dy*.22,G+.06),.06)
    for p in(alto,baixo):cil(p-V((.025,0,0)),p+V((.025,0,0)),.042,ESC)
    return alto,baixo
def cabo(a,b):cil(a,b,.0055,CABO,True)
def nada():pass
def reg(n,mus,cam,est,fn):EX[n]=(mus,cam,est,fn)
# ======== BRACOS ========
def _rosca_barra(comp):
    def f(P,t):
        pes(P)
        for l,s in LADOS:M_(P,s,lerp((s*.18,-.1,.09),(s*.18,-.3,.5),t),(s*.1,1,-1),TS(s))
        P.resolve();barra(P,.32 if comp else .55,.0 if comp else .1)
    return f
reg("rosca-barra-w",["biceps"],(24,6,-.02,4.7),nada,_rosca_barra(True))
reg("rosca-barra",["biceps"],(24,6,-.02,4.7),nada,_rosca_barra(False))
def _alternada(P,t):
    pes(P)
    for l,s in LADOS:
        u=t if s>0 else 1-t
        M_(P,s,lerp((s*.24,-.04,.07),(s*.2,-.26,.5),u),(s*.1,1,-1),lerp((TN(s),0,0),(TS(s),0,0),u).x)
    P.resolve();halteres(P)
reg("rosca-alternada",["biceps"],(24,6,-.02,4.7),nada,_alternada)
def _martelo(P,t):
    pes(P)
    for l,s in LADOS:M_(P,s,lerp((s*.235,-.04,.06),(s*.235,-.235,.47),t),(s*.1,1,-1),TN(s))
    P.resolve();halteres(P)
reg("rosca-martelo",["biceps"],(22,6,-.02,4.7),nada,_martelo)
def _ccol():
    global _alto,_baixo
    _alto,_baixo=coluna()
def _martelo_corda(P,t):
    corpo(P,HIPC+V((0,.06,0)),0);pes(P,.06)
    for l,s in LADOS:M_(P,s,lerp((s*.08,-.2,.05),(s*.13,-.25,.47),t),(s*.15,1,-1),TN(s))
    P.resolve();a,b=centro_mao(P,"L"),centro_mao(P,"R");m=(a+b)/2+V((0,0,-.1));cil(a,m,.012,CABO,True);cil(b,m,.012,CABO,True);cabo(m,_baixo)
reg("rosca-martelo-corda",["biceps"],(58,6,-.02,5.0),_ccol,_martelo_corda)
def _rosca_polia(P,t):
    corpo(P,HIPC+V((0,.06,0)),0);pes(P,.06)
    for l,s in LADOS:M_(P,s,lerp((s*.15,-.2,.08),(s*.17,-.28,.48),t),(s*.1,1,-1),TS(s))
    P.resolve();m=barra(P,.28,0);cabo(m,_baixo)
reg("rosca-polia-baixa",["biceps"],(58,6,-.02,5.0),_ccol,_rosca_polia)
def _rosca_sent(P,t):
    sentado(P,.05)
    for l,s in LADOS:M_(P,s,lerp((s*.26,.0,G+.72),(s*.24,-.2,G+1.17),t),(s*.15,1,-1),lerp((TN(s),0,0),(TS(s),0,0),t).x)
    P.resolve();halteres(P)
def _e_sent():banco(.05,.42,G+.48);encosto((0,.05,G+.48),0,.72)
reg("rosca-sentado",["biceps"],(28,5,-.2,4.6),_e_sent,_rosca_sent)
def _inclinada(P,t):
    sentado(P,.1,G+.48,-35,-.5)
    P.delta["neck01"]=q((1,0,0),18)
    o=lambda s:om(P,s)
    for l,s in LADOS:
        u=t if s>0 else 0
        M_(P,s,lerp(o(s)+V((s*.04,.1,-.5)),o(s)+V((s*.03,-.14,-.13)),u),(s*.1,1,-.6),TS(s))
    P.resolve();halteres(P)
def _e_incl():banco(.1,.42,G+.48);encosto((0,.1,G+.5),35,.82)
reg("rosca-inclinada",["biceps"],(48,6,-.2,4.8),_e_incl,_inclinada)
def _scott(maq):
    def f(P,t):
        sentado(P,.12,G+.5,12)
        for l,s in LADOS:M_(P,s,lerp((s*.16,-.56,G+.62),(s*.16,-.36,G+1.17),t),(s*.1,.3,-1),TS(s))
        P.resolve();m=barra(P,.3 if not maq else .3,0)
        if maq:tubo(m+V((.3,0,0)),V((.3,-.3,G+.72)),.035,ACO,True);tubo(m-V((.3,0,0)),V((-.3,-.3,G+.72)),.035,ACO,True)
    return f
def _e_scott():
    banco(.12,.4,G+.5);caixa((0,-.3,G+.82),(.46,.13,.22),PAD,False,q((1,0,0),-35));caixa((0,-.28,G+.36),(.12,.12,.72))
reg("rosca-scott",["biceps"],(96,6,-.2,4.5),_e_scott,_scott(False))
reg("rosca-scott-maquina",["biceps"],(96,6,-.2,4.5),_e_scott,_scott(True))
def _push(punho_t,c=.15,tipo="barra",tw=None):
    def f(P,t):
        corpo(P,HIPC+V((0,.05,0)),6);pes(P,.05)
        for l,s in LADOS:
            hd=lerp((s*.1,-.42,.5),(s*.1,-.235,.09),t)
            if tipo=="corda":hd=lerp((s*.07,-.42,.5),(s*.17,-.2,.08),t)
            M_(P,s,hd,(s*.25,1,-.2),tw(s) if tw else s*-30,lerp((0,-.75,-.3),(0,-.3,-.9),t))
        P.resolve();a,b=centro_mao(P,"L"),centro_mao(P,"R");m=(a+b)/2
        if tipo=="corda":
            n=m+V((0,-.03,.14));cil(a,n,.011,CABO,True);cil(b,n,.011,CABO,True);cabo(n,_alto)
        elif tipo=="dois":
            n=m+V((0,-.02,.12));tubo(a,n,.02,ACO,True);tubo(b,n,.02,ACO,True);cabo(n,_alto)
        else:
            tubo(m+V((c,0,0)),m-V((c,0,0)),.022,ACO,True);cabo(m,_alto)
    return f
CTRI=(122,6,.1,5.2)
reg("triceps-pulley",["triceps"],CTRI,_ccol,_push(0))
reg("triceps-barra-reta",["triceps"],CTRI,_ccol,_push(0,.19))
reg("triceps-barra-w",["triceps"],CTRI,_ccol,_push(0,.15))
reg("triceps-corda",["triceps"],CTRI,_ccol,_push(0,0,"corda",TN))
reg("triceps-invertida",["triceps"],CTRI,_ccol,_push(0,.15,"barra",TS))
reg("triceps-neutra",["triceps"],CTRI,_ccol,_push(0,0,"dois",TN))
def _push1(P,t):
    corpo(P,HIPC+V((0,.05,0)),5);pes(P,.05)
    M_(P,1,lerp((.13,-.4,.5),(.2,-.2,.08),t),(.25,1,-.2),TN(1),lerp((0,-.75,-.3),(0,-.3,-.9),t))
    M_(P,-1,(-.25,-.06,.09),(-.2,.6,-1),TN(-1))
    P.resolve();m=centro_mao(P,"L");cil(m-V((.05,0,0)),m+V((.05,0,0)),.016,ACO,True);cabo(m,_alto)
reg("triceps-polia-unilateral",["triceps"],CTRI,_ccol,_push1)
def _frances(P,t):
    pes(P)
    for l,s in LADOS:M_(P,s,lerp((s*.03,.2,.68),(s*.03,-.02,1.13),t),(s*.18,-.5,1),TN(s),lerp((0,.9,-.5),(0,0,1),t))
    P.resolve();m=(centro_mao(P,"L")+centro_mao(P,"R"))/2;halter(m,V((1,0,0)) if False else V((0,0,1)))
reg("triceps-frances",["triceps"],(150,4,.1,5.2),nada,_frances)
def _testa(P,t):
    corpo(P,(0,-.05,G+.56),-90);
    for l,s in LADOS:
        Pe(P,s,(s*.22,-.6,G+.095),(s*.1,-.3,1),(s*.1,-1,-.4));M_(P,s,lerp((s*.13,.33,G+.85),(s*.13,.22,G+1.15),t),(s*.06,.3,.9),TP(s),(0,-.1,1))
    P.resolve();barra(P,.3,0)
def _e_deit():banco(.15,1.25,G+.46)
reg("triceps-testa",["triceps"],(68,10,-.3,4.6),_e_deit,_testa)
def _tri_maq(P,t):
    sentado(P,.05)
    for l,s in LADOS:M_(P,s,lerp((s*.24,-.3,G+1.06),(s*.24,-.22,G+.64),t),(s*.2,1,0),TN(s))
    P.resolve()
    for l,s in LADOS:
        h=centro_mao(P,l);cil(h-V((.04,0,0)),h+V((.04,0,0)),.016,ACO,True);tubo(h,(s*.34,-.5,G+1.0),.03,ACO,True)
def _e_tmaq():banco(.05,.42,G+.48);encosto((0,.05,G+.48),0,.72);caixa((0,-.62,G+.7),(.5,.14,1.4),CLA)
reg("triceps-maquina",["triceps"],(118,6,-.1,4.8),_e_tmaq,_tri_maq)
def _banco_tri(P,t):
    z=lerp((0,0,G+.28),(0,0,G+.54),t).z
    corpo(P,(0,.08,z),4)
    for l,s in LADOS:
        M_(P,s,(s*.2,.28,G+.5),(s*.1,1,.3),TP(s),(0,-.3,-.9));Pe(P,s,(s*.14,-.72,G+.095),(s*.05,-.5,1),(s*.05,-.5,1))
    P.resolve()
def _e_btri():caixa((0,.42,G+.23),(.7,.42,.46),PAD)
reg("triceps-banco",["triceps"],(120,6,-.25,4.8),_e_btri,_banco_tri)
# ======== OMBROS ========
def _lat(P,t):
    pes(P)
    for l,s in LADOS:
        M_(P,s,lerp((s*.3,-.08,.09),(s*.73,-.06,.53),t),(s*.1,.3,-1),s*-70);P.delta["clavicle."+l]=q((0,1,0),-s*6*t)
    P.resolve();halteres(P,(0,1,0))
reg("elevacao-lateral",["ombro"],(12,8,-.02,4.9),nada,_lat)
def _frontal(P,t):
    pes(P)
    for l,s in LADOS:M_(P,s,lerp((s*.22,-.14,.07),(s*.2,-.68,.6),t),(s*.3,.2,-1),TP(s))
    P.resolve();halteres(P,(1,0,0))
reg("elevacao-frontal",["ombro"],(60,6,-.02,4.9),nada,_frontal)
def _lat_cabo(P,t):
    corpo(P,HIPC+V((.1,0,0)));pes(P)
    M_(P,1,lerp((-.04,-.14,.08),(.72,-.06,.53),t),(.1,.3,-1),-70)
    M_(P,-1,(-.25,-.05,.1),(-.3,.6,-1),TN(-1))
    P.resolve();m=centro_mao(P,"L");cil(m-V((.04,0,0)),m+V((.04,0,0)),.016,ACO,True);cabo(m,_col_x)
def _e_latc():
    global _col_x
    _,_col_x=coluna(-.58,.12,-1)
reg("elevacao-lateral-polia",["ombro"],(8,8,-.02,5.1),_e_latc,_lat_cabo)
def _dev_halt(P,t):
    sentado(P,.05)
    for l,s in LADOS:M_(P,s,lerp((s*.33,-.05,G+1.17),(s*.17,-.05,G+1.66),t),(s*1,.3,-.3),TP(s),(0,0,1))
    P.resolve();halteres(P,(1,0,0))
def _e_dev():banco(.05,.42,G+.48);encosto((0,.05,G+.48),0,.82)
reg("desenvolvimento-halteres",["ombro"],(22,6,.0,4.9),_e_dev,_dev_halt)
def _dev_barra(smith):
    def f(P,t):
        pes(P,0,.16)
        for l,s in LADOS:M_(P,s,lerp((s*.3,-.14,.68),(s*.26,-.06,1.1),t),(s*1,.3,-.4),TP(s),(0,0,1))
        P.resolve();barra(P,.62,.1)
    return f
def _e_smith():
    for s in(-1,1):tubo((s*.7,.0,G+.04),(s*.7,.0,G+2.1),.05)
    caixa((0,0,G+2.1),(1.5,.06,.06))
reg("desenvolvimento-militar",["ombro"],(26,6,.12,5.3),nada,_dev_barra(False))
reg("desenvolvimento-smith",["ombro"],(26,6,.12,5.3),_e_smith,_dev_barra(True))
def _dev_maq(P,t):
    sentado(P,.05)
    for l,s in LADOS:M_(P,s,lerp((s*.3,-.1,G+1.2),(s*.24,-.12,G+1.64),t),(s*1,.3,-.3),TN(s),(0,-.1,1))
    P.resolve()
    for l,s in LADOS:
        h=centro_mao(P,l);cil(h-V((0,.06,0)),h+V((0,.06,0)),.016,ACO,True);tubo(h,(s*.45,.2,G+1.0),.035,ACO,True)
def _e_dmaq():_e_dev();caixa((0,.22,G+.8),(1.0,.08,.08));caixa((.48,.22,G+.5),(.07,.07,1.0));caixa((-.48,.22,G+.5),(.07,.07,1.0))
reg("desenvolvimento-maquina",["ombro"],(26,6,.0,5.0),_e_dmaq,_dev_maq)
def _vinv(P,t):
    sentado(P,.0,G+.48,-3,-.42)
    for l,s in LADOS:M_(P,s,lerp((s*.08,-.5,.3),(s*.6,-.02,.31),t),(s*.25,.15,-1),TN(s))
    P.resolve()
    for l,s in LADOS:
        h=centro_mao(P,l);cil(h-V((0,0,.06)),h+V((0,0,.06)),.016,ACO,True);tubo(h,(s*.03,-.42,.58),.03,ACO,True)
def _e_vinv():banco(.0,.42,G+.48);caixa((0,-.22,.18),(.26,.08,.6),PAD);caixa((0,-.45,-.1),(.14,.14,1.5),CLA)
reg("voador-inverso",["ombro_post","trapezio"],(198,10,.0,5.0),_e_vinv,_vinv)
def _post_polia(P,t):
    pes(P,0,.15);corpo(P,HIPC,14)
    M_(P,1,lerp((-.12,-.32,-.02),(.62,-.02,.42),t),(.1,.5,-1),-70)
    M_(P,-1,(-.25,-.1,.1),(-.2,.6,-1),TN(-1))
    P.resolve();m=centro_mao(P,"L");cil(m-V((.04,0,0)),m+V((.04,0,0)),.016,ACO,True);cabo(m,_col_x)
reg("posterior-polia-baixa",["ombro_post"],(205,8,.0,5.1),_e_latc,_post_polia)
def _cruz_inv(P,t):
    corpo(P,(0,.3,G+.82),48)
    for l,s in LADOS:
        Pe(P,s,(s*.17,.6,G+.095),(s*.05,-1,.1),(s*.1,-1,-.42))
        o=om(P,s);M_(P,s,lerp(o+V((s*.04,-.02,-.5)),o+V((s*.5,-.02,-.08)),t),(s*.1,.6,-1),TN(s))
    P.resolve();halteres(P,(0,1,0))
def _e_cinv():caixa((0,.0,G+1.02),(.32,.08,.86),PAD,False,q((1,0,0),48));caixa((0,.22,G+.34),(.14,.14,.68))
reg("crucifixo-inverso",["ombro_post"],(150,12,-.2,5.0),_e_cinv,_cruz_inv)
def _face(P,t):
    corpo(P,HIPC+V((0,.05,0)),-5);pes(P,.05)
    for l,s in LADOS:M_(P,s,lerp((s*.06,-.56,.62),(s*.24,-.13,.74),t),(s*1,.3,.25),TP(s))
    P.resolve();a,b=centro_mao(P,"L"),centro_mao(P,"R");n=(a+b)/2+V((0,-.14,0));cil(a,n,.011,CABO,True);cil(b,n,.011,CABO,True);cabo(n,_alto)
reg("face-pull",["ombro_post","trapezio"],(150,6,.1,5.2),_ccol,_face)
# ======== PEITO ========
def _supino(tp,lean=-90,cz=G+.56):
    def f(P,t):
        corpo(P,(0,-.05,cz),lean)
        x=.3 if tp!="halter" else .3
        o0=om(P,1);o1=om(P,-1)
        for l,s in LADOS:
            Pe(P,s,(s*.24,-.62,G+.095),(s*.12,-.3,1),(s*.1,-1,-.4))
            o=o0 if s>0 else o1;n=P.base@V((0,-1,0))
            ini=o+n*.13+V((s*.14,0,0))-P.base@V((0,0,1))*.07;fi=o+n*.52+V((s*.0,0,0))-P.base@V((0,0,1))*.0
            M_(P,s,lerp(ini,fi+V((s*.03,0,0)),t),(s*1,0,-.5),TP(s),n)
        P.delta["neck01"]=q((1,0,0),10)
        P.resolve()
        if tp=="barra":barra(P,.62,.1)
        elif tp=="halter":halteres(P,(1,0,0))
        else:
            for l,s in LADOS:
                h=centro_mao(P,l);cil(h-V((.05,0,0)),h+V((.05,0,0)),.016,ACO,True);tubo(h,(s*.44,.42,G+.7),.03,ACO,True)
    return f
def _e_sup():banco(.15,1.25,G+.46)
def _e_supb():
    _e_sup()
    for s in(-1,1):tubo((s*.42,.42,G+.04),(s*.42,.42,G+1.0),.05)
def _e_supm():_e_sup();caixa((0,.45,G+.45),(.95,.1,.9),CLA)
CSUP=(62,12,-.25,4.8)
reg("supino-reto-barra",["peito"],CSUP,_e_supb,_supino("barra"))
reg("supino-reto-halteres",["peito"],CSUP,_e_sup,_supino("halter"))
reg("supino-reto-maquina",["peito"],CSUP,_e_supm,_supino("maq"))
reg("supino-declinado",["peito"],CSUP,_e_supb,_supino("barra",-104,G+.6))
def _sup_inc(tp):
    def f(P,t):
        corpo(P,(0,.02,G+.6),-48)
        o0=om(P,1);o1=om(P,-1);n=P.base@V((0,-1,0));u=P.base@V((0,0,1))
        for l,s in LADOS:
            Pe(P,s,(s*.2,-.55,G+.095),(s*.1,-.8,.4),(s*.1,-1,-.4))
            o=o0 if s>0 else o1
            M_(P,s,lerp(o+n*.13+V((s*.14,0,0))-u*.07,o+n*.52+V((s*.03,0,0))+u*.05,t),(s*1,.2,-.3),TP(s),n)
        P.delta["neck01"]=q((1,0,0),22)
        P.resolve()
        if tp=="barra":barra(P,.62,.1)
        elif tp=="halter":halteres(P,(1,0,0))
        else:
            for l,s in LADOS:
                h=centro_mao(P,l);cil(h-V((.05,0,0)),h+V((.05,0,0)),.016,ACO,True);tubo(h,(s*.46,.3,G+.9),.03,ACO,True)
    return f
def _e_inc():
    caixa((0,.1,G+.48),(.34,.42,.08),PAD);encosto((0,.02,G+.6),48,.95);caixa((0,.1,G+.22),(.14,.14,.44))
def _e_incb():
    _e_inc()
    for s in(-1,1):tubo((s*.42,.55,G+.04),(s*.42,.55,G+1.45),.05)
def _e_incm():_e_inc();caixa((0,.55,G+.75),(1.0,.1,1.5),CLA)
CINC=(58,10,-.15,4.9)
reg("supino-inclinado-barra",["peito"],CINC,_e_incb,_sup_inc("barra"))
reg("supino-inclinado-halteres",["peito"],CINC,_e_inc,_sup_inc("halter"))
reg("supino-inclinado-maquina",["peito"],CINC,_e_incm,_sup_inc("maq"))
def _crucifixo(P,t):
    corpo(P,(0,-.05,G+.56),-90)
    for l,s in LADOS:
        Pe(P,s,(s*.24,-.62,G+.095),(s*.12,-.3,1),(s*.1,-1,-.4))
        o=om(P,s);M_(P,s,lerp(o+V((s*.47,0,.1)),o+V((-s*.08,0,.5)),t),(s*.5,0,-1),TN(s),(0,0,1))
    P.resolve();halteres(P,(0,1,0))
reg("crucifixo-halteres",["peito"],CSUP,_e_sup,_crucifixo)
def _voador(P,t):
    sentado(P,.05)
    for l,s in LADOS:M_(P,s,lerp((s*.62,-.04,.3),(s*.07,-.5,.28),t),(s*.3,.15,-1),TN(s))
    P.resolve()
    for l,s in LADOS:
        h=centro_mao(P,l);cil(h-V((0,0,.07)),h+V((0,0,.07)),.016,ACO,True);tubo(h,(s*.34,.28,.62),.03,ACO,True)
def _e_voa():banco(.05,.42,G+.48);encosto((0,.05,G+.48),0,.82);caixa((0,.3,-.1),(.14,.14,1.5),CLA);caixa((0,.3,.62),(.7,.08,.08))
reg("voador-peito",["peito"],(24,8,.0,5.0),_e_voa,_voador)
def _cross(alta):
    def f(P,t):
        corpo(P,HIPC+V((0,0,0)),12 if alta else 3)
        for l,s in LADOS:
            Pe(P,s,(s*.12,(-.2 if s>0 else .18),G+.095),(s*.05,-1,0))
            if alta:ini=(s*.62,.0,.82);fi=(s*.05,-.46,.12)
            else:ini=(s*.6,.0,.05);fi=(s*.05,-.42,.68)
            M_(P,s,lerp(ini,fi,t),(s*.4,.5,-.6),TN(s))
        P.resolve()
        for l,s in LADOS:
            h=centro_mao(P,l);cil(h-V((0,0,.05)),h+V((0,0,.05)),.016,ACO,True);cabo(h,(_cA if alta else _cB)[0 if s>0 else 1])
    return f
def _e_cross():
    global _cA,_cB
    a1,b1=coluna(.95,.1,0.0001);a2,b2=coluna(-.95,.1,0.0001);caixa((0,.1,G+2.0),(2.0,.08,.08));_cA=(a1,a2);_cB=(b1,b2)
reg("crossover-alta",["peito"],(14,6,.1,6.0),_e_cross,_cross(True))
reg("crossover-baixa",["peito"],(14,6,.1,6.0),_e_cross,_cross(False))
def _mergulho(P,t):
    z=lerp((0,0,G+.56),(0,0,G+.82),t).z
    corpo(P,(0,.02,z),14)
    for l,s in LADOS:
        M_(P,s,(s*.3,-.06,G+1.1),(s*.3,1,.2),TN(s),(0,0,-1) if False else None);Pe(P,s,(s*.13,.36,z-.62),(s*.05,-1,.2),(s*.05,-.5,-1))
    P.resolve()
def _e_merg():
    for s in(-1,1):
        tubo((s*.3,.4,G+1.03),(s*.3,-.5,G+1.03),.05)
        tubo((s*.3,.35,G+.0),(s*.3,.35,G+1.03),.05);tubo((s*.3,-.45,G+.0),(s*.3,-.45,G+1.03),.05)
reg("mergulho",["peito","triceps"],(52,6,.0,5.0),_e_merg,_mergulho)
def _flexao(joelho=False,inc=False):
    def f(P,t):
        hz=G+(lerp((0,0,.22),(0,0,.42),t).z)+(.3 if inc else 0)
        ang=lerp((0,0,84),(0,0,74),t).z-(16 if inc else 0)
        corpo(P,(0,.1,hz),ang if not joelho else ang-6)
        ch=-.56
        for l,s in LADOS:
            M_(P,s,(s*.3,ch,(G+.06) if not inc else G+.5),(s*.7,.6,.35),TP(s),(0,-.6,.1))
            if joelho:Pe(P,s,(s*.1,.45,G+.22),(s*.05,.0,-1),(s*.05,1,.1))
            else:Pe(P,s,(s*.1,.88,G+.16),(s*.05,0,1),(s*.05,-.2,-1))
        P.delta["neck01"]=q((1,0,0),-14)
        P.resolve()
    return f
reg("flexao",["peito","triceps"],(68,8,-.45,5.0),nada,_flexao())
reg("flexao-joelhos",["peito","triceps"],(68,8,-.45,5.0),nada,_flexao(True))
def _e_flexinc():caixa((0,-.56,G+.22),(.8,.4,.44),PAD)
reg("flexao-inclinada",["peito","triceps"],(68,8,-.35,5.0),_e_flexinc,_flexao(False,True))
def _pike(P,t):
    hz=G+.82
    corpo(P,(0,.28,hz),lerp((0,0,108),(0,0,122),t).z)
    for l,s in LADOS:
        M_(P,s,(s*.26,-.42,G+.06),(s*.7,.5,.4),TP(s),(0,-.6,.1));Pe(P,s,(s*.1,.76,G+.15),(s*.05,0,1),(s*.05,-.3,-1))
    P.delta["neck01"]=q((1,0,0),-22);P.resolve()
reg("flexao-pike",["ombro"],(72,8,-.3,4.9),nada,_pike)
# ======== COSTAS ========
ZS=G+.5
def _e_pux():
    banco(.1,.42,ZS,.42);caixa((0,-.62,G+1.15),(.14,.14,2.3));tubo((0,-.62,G+2.28),(0,-.22,G+2.28),.09);cil((-.03,-.22,G+2.22),(.03,-.22,G+2.22),.05,ESC)
    tubo((0,-.42,G+.75),(0,-.62,G+.75),.05);caixa((0,-.34,G+.73),(.42,.09,.09),PAD);caixa((0,-.5,G+.05),(.5,.7,.1))
def _pux(tipo):
    def f(P,t):
        corpo(P,(0,.1,ZS+.125),-2-(10*t))
        for l,s in LADOS:
            Pe(P,s,(s*.15,-.42,G+.17),(s*.08,-1,.2),(s*.08,-1,-.38))
            x0,x1,tw={"neutra":(.035,.04,TN(s)),"tri":(.03,.045,TN(s)),"aberta":(.42,.36,TP(s))}[tipo]
            M_(P,s,lerp((s*x0,-.18,ZS+1.27),(s*x1,-.19 if tipo!="aberta" else -.1,ZS+.72),t),(s*.75,.45,lerp((0,0,.25),(0,0,-.75),t).z),tw)
            P.delta["clavicle."+l]=q((0,1,0),-s*14*(1-t))
        P.resolve()
        a,b=fim(P,"L"),fim(P,"R");m=(a+b)/2+V((0,0,.06))
        if tipo=="aberta":barra(P,.5,0);cabo(m,(0,-.22,G+2.22))
        else:tubo(a+V((0,0,.05)),b+V((0,0,.05)),.022,ACO,True);tubo(m,m+V((0,0,.1)),.022,ACO,True);cabo(m+V((0,0,.1)),(0,-.22,G+2.22))
    return f
CPX=(205,9,.22,5.3)
reg("puxada-neutra",["dorsal"],CPX,_e_pux,_pux("neutra"))
reg("puxada-triangulo",["dorsal"],CPX,_e_pux,_pux("tri"))
reg("puxada-aberta",["dorsal"],CPX,_e_pux,_pux("aberta"))
def _pulldown(P,t):
    corpo(P,HIPC+V((0,.18,-.04)),24)
    for l,s in LADOS:
        Pe(P,s,(s*.14,.2,G+.095),(s*.06,-1,0))
        o=om(P,s);M_(P,s,lerp((s*.12,-.42,.92),(s*.2,-.1,.13),t),(s*.3,1,0),TP(s))
    P.resolve();a,b=centro_mao(P,"L"),centro_mao(P,"R");n=(a+b)/2+V((0,-.08,.06));cil(a,n,.011,CABO,True);cil(b,n,.011,CABO,True);cabo(n,_alto)
reg("pulldown-corda",["dorsal"],(150,6,.1,5.3),_ccol,_pulldown)
def _rem_baixa(tipo):
    def f(P,t):
        sentado(P,.15,G+.48,lerp((0,0,4),(0,0,-6),t).z,-.42)
        for l,s in LADOS:
            x,tw={"neutra":(.13,TN(s)),"pron":(.26,TP(s)),"cabo":(.05,TN(s))}[tipo]
            M_(P,s,lerp((s*x,-.4,.42),(s*(x+.06),-.02,.26),t),(s*.35,1,-.3),tw)
        P.resolve()
        if tipo=="cabo":
            m=(centro_mao(P,"L")+centro_mao(P,"R"))/2;tubo(fim(P,"L"),fim(P,"R"),.02,ACO,True);cabo(m,(0,-.82,G+.32))
        else:
            for l,s in LADOS:
                h=centro_mao(P,l);cil(h-V((0,0,.06)),h+V((0,0,.06)),.016,ACO,True);tubo(h,(s*.28,-.68,G+.8),.03,ACO,True)
    return f
def _e_rem():banco(.15,.42,G+.48);caixa((0,-.14,.32),(.3,.08,.34),PAD);tubo((0,-.14,.18),(0,-.62,G+.1),.06);caixa((0,-.78,G+.5),(.5,.14,1.0),CLA)
def _e_remc():banco(.15,.42,G+.48);caixa((0,-.88,G+.45),(.3,.14,.9),CLA);caixa((0,-.52,G+.05),(.5,.14,.1))
CRM=(138,8,-.15,5.1)
reg("remada-baixa-articulada",["dorsal"],CRM,_e_rem,_rem_baixa("neutra"))
reg("remada-articulada-pronada",["dorsal","ombro_post"],CRM,_e_rem,_rem_baixa("pron"))
reg("remada-baixa-cabo",["dorsal"],CRM,_e_remc,_rem_baixa("cabo"))
def _curvada(tp):
    def f(P,t):
        corpo(P,HIPC+V((0,.13,-.06)),52)
        for l,s in LADOS:
            Pe(P,s,(s*.15,.0,G+.095),(s*.08,-1,0))
            o=om(P,s);M_(P,s,lerp(o+V((s*.0,-.05,-.5)),o+V((s*.0,.22,-.22)),t),(s*.3,1,.2),TP(s) if tp=="barra" else TN(s))
        P.delta["neck01"]=q((1,0,0),-30);P.resolve()
        if tp=="barra":barra(P,.6,.11)
        else:halteres(P,(1,0,0))
    return f
CCV=(140,6,-.15,5.0)
reg("remada-curvada-barra",["dorsal","ombro_post"],CCV,nada,_curvada("barra"))
reg("remada-curvada-halteres",["dorsal","ombro_post"],CCV,nada,_curvada("halter"))
def _serrote(P,t):
    corpo(P,(0,.28,G+.76),72)
    Pe(P,1,(.22,.2,G+.095),(.08,-1,0))
    Pe(P,-1,(-.12,.62,G+.56),(-.05,-1,-.6),(-.05,1,-.1))
    o=om(P,1);ob=om(P,-1)
    M_(P,1,lerp(o+V((.02,.0,-.5)),o+V((.03,.28,-.2)),t),(.2,1,.2),TN(1))
    M_(P,-1,(-.2,-.42,G+.52),(-.4,.3,.2),TP(-1),(0,-.3,-1))
    P.delta["neck01"]=q((1,0,0),-28);P.resolve();h=centro_mao(P,"L");halter(h,V((0,1,0)))
def _e_serr():caixa((-.14,.2,G+.46),(.42,1.2,.08),PAD);caixa((-.14,.2,G+.21),(.14,.14,.42))
reg("remada-serrote",["dorsal"],(128,10,-.25,5.0),_e_serr,_serrote)
def _invert(P,t):
    z=lerp((0,0,G+.22),(0,0,G+.42),t).z
    corpo(P,(0,.15,z),-78+lerp((0,0,0),(0,0,4),t).z)
    for l,s in LADOS:
        M_(P,s,(s*.3,.55,G+.86),(s*.6,-.5,-.5),TP(s));Pe(P,s,(s*.11,-.72,G+.1),(s*.05,0,1),(s*.05,-.1,1))
    P.delta["neck01"]=q((1,0,0),15);P.resolve();
def _e_inv():
    tubo((-.6,.58,G+.86),(.6,.58,G+.86),.03)
    for s in(-1,1):tubo((s*.6,.58,G),(s*.6,.58,G+.88),.05)
reg("remada-invertida",["dorsal"],(112,6,-.35,4.9),_e_inv,_invert)
def _elastico(P,t):
    sentado(P,.1,G+.14,-3,-.72)
    for l,s in LADOS:
        Pe(P,s,(s*.1,-.68,G+.08),(s*.05,-.2,1),(s*.05,-.1,1));M_(P,s,lerp((s*.14,-.42,G+.66),(s*.2,.0,G+.72),t),(s*.35,1,-.3),TN(s))
    P.resolve();a,b=centro_mao(P,"L"),centro_mao(P,"R")
    for h,s in((a,1),(b,-1)):cil(h,(s*.08,-.78,G+.1),.007,CABO,True)
reg("remada-elastico",["dorsal"],(138,10,-.45,4.6),nada,_elastico)
def _fixa(ass):
    def f(P,t):
        z=lerp((0,0,.35),(0,0,.82),t).z-(.0 if not ass else .0)
        corpo(P,(0,.04,z-.3+.0),4)
        for l,s in LADOS:
            M_(P,s,(s*.36,-.03,1.32),(s*.75,.5,-.35),TP(s),(0,0,1))
            if ass:Pe(P,s,(s*.12,.32,z-.78),(s*.05,-1,.1),(s*.05,-.5,-1))
            else:Pe(P,s,(s*.12,.2,z-1.02),(s*.05,-1,.1),(s*.05,-.6,-1))
            P.delta["clavicle."+l]=q((0,1,0),-s*14*(1-t))
        P.resolve()
    return f
def _e_fixa():
    tubo((-.72,-.03,1.4),(.72,-.03,1.4),.03)
    for s in(-1,1):tubo((s*.72,-.03,G),(s*.72,-.03,1.42),.06)
reg("barra-fixa",["dorsal"],(198,6,.3,6.0),_e_fixa,_fixa(False))
def _e_fixaa():_e_fixa();caixa((0,.4,G+.15),(.5,.44,.1),PAD);tubo((0,.5,G),(0,.5,G+.3),.05)
reg("barra-fixa-assistida",["dorsal"],(198,6,.3,6.0),_e_fixaa,_fixa(True))
# ======== PERNAS ========
def _agach(tp="livre"):
    def f(P,t):
        hz=lerp(HIPC,(0,0,G+.46+.06),t).z;lean=lerp((0,0,4),(0,0,32 if tp!="smith" else 16),t).z
        corpo(P,(0,lerp((0,0,0),(0,.22 if tp!="smith" else .1,0),t).y,hz),lean)
        for l,s in LADOS:
            Pe(P,s,(s*.17,0,G+.095),(s*.32,-1,.1),(s*.2,-1,-.42))
            o=om(P,s);u=P.base@V((0,0,1));n=P.base@V((0,-1,0))
            if tp=="goblet":M_(P,s,o+n*.2+V((-s*.15,0,-.1)),(s*.5,.3,-.8),TN(s),(0,0,1))
            elif tp=="peso":M_(P,s,o+n*.52,(s*.1,.2,-1),TP(s))
            else:M_(P,s,o+V((s*.14,.0,.0))-n*.1+u*.03,(s*.7,.3,-.9),TP(s))
        P.delta["neck01"]=q((1,0,0),-lean*.75);P.resolve()
        if tp in("livre","smith"):
            c=(P.M["neck01"].translation)-P.base@V((0,-1,0))*.02+V((0,.07,-.02));cil(c-V((.62,0,0)),c+V((.62,0,0)),.014,ACO,True)
            for s in(-1,1):cil(c+V((s*.46,0,0)),c+V((s*.53,0,0)),.11,ESC,True)
        if tp=="goblet":m=(centro_mao(P,"L")+centro_mao(P,"R"))/2;halter(m,(0,0,1))
    return f
CAG=(58,6,.0,5.0)
reg("agachamento-livre",["quadriceps","gluteo"],CAG,nada,_agach())
reg("agachamento-smith",["quadriceps","gluteo"],CAG,_e_smith,_agach("smith"))
reg("agachamento-goblet",["quadriceps","gluteo"],CAG,nada,_agach("goblet"))
reg("agachamento-peso-corpo",["quadriceps","gluteo"],CAG,nada,_agach("peso"))
def _hack(P,t):
    d=V((0,.4,.92));h=V((0,.12,G+.92))+d*(-.5*t);corpo(P,h,-18)
    for l,s in LADOS:
        Pe(P,s,(s*.17,-.42,G+.26),(s*.3,-.8,.5),(s*.15,-1,-.1))
        o=om(P,s);M_(P,s,o+V((s*.12,-.2,.03)),(s*.5,.6,-.6),TN(s))
    P.resolve()
def _e_hack():
    caixa((0,-.42,G+.13),(.6,.42,.05),ACO,False,q((1,0,0),8));
    for x in(-.24,.24):tubo((x,.55,G+.06),(x,.0,G+1.65),.05)
    caixa((0,.25,G+.03),(.62,1.3,.06));encosto((0,.2,G+.68),22,.95,.4,.1)
reg("agachamento-hack",["quadriceps","gluteo"],(62,8,.0,5.2),_e_hack,_hack)
def _lp(lean,ang,cal=None):
    Hp=V((0,.2,G+.42));a=math.radians(ang);uv=V((0,-math.cos(a),math.sin(a)));ni=V((0,math.sin(a),math.cos(a)))
    def f(P,t):
        P.loc=Hp-V((0,0,.1));P.base=q((1,0,0),-lean);P.delta["neck01"]=q((1,0,0),lean*.45)
        k=(.42+.42*t) if cal is None else .84
        for l,s in LADOS:
            A=Hp+uv*k+V((s*.15,0,.06))
            if cal is None:dp=(uv*.45+ni*.9)
            else:dp=uv*(.32+.5*(cal*t))+ni*(.9-.3*(cal*t));A=A+uv*(.05*cal*t)
            Pe(P,s,A,(s*.22,ni.y,ni.z),V((s*.06,dp.y,dp.z)))
            M_(P,s,Hp+V((s*.36,.06,.1)),(s*.8,.3,.1),s*-20)
        P.resolve()
        c=Hp+uv*k+V((0,0,.06))+ni*.09+uv*.075
        caixa(c,(.56,.46,.04),ESC,True,uv.to_track_quat("Z","Y"))
        for s in(-1,1):
            cil(c+uv*.08+V((s*.3,0,0)),c+uv*.08+V((s*.36,0,0)),.12,ESC,True);cil(c+V((s*.2,0,0))+uv*.08,c+V((s*.42,0,0))+uv*.08,.02,ACO,True)
    return f
def _e_lp(lean,ang):
    Hp=V((0,.2,G+.42));a=math.radians(ang);uv=V((0,-math.cos(a),math.sin(a)))
    def e():
        d=V((0,math.sin(math.radians(lean)),math.cos(math.radians(lean))))
        caixa(Hp+V((0,.04,-.1))+d*.34,(.5,.08,.82),PAD,False,q((1,0,0),-lean))
        caixa(Hp+V((0,-.03,-.13)),(.5,.5,.08),PAD);caixa((0,Hp.y,(G+Hp.z-.17)/2),(.4,.5,Hp.z-.17-G))
        for x in(-.2,.2):tubo(Hp+V((x,-.15,-.34)),Hp+V((x,-.15,-.34))+uv*1.3,.05)
        caixa((0,-.3,G+.03),(.52,1.3,.06))
    return e
reg("leg-press-45",["quadriceps","gluteo"],(70,10,-.22,5.0),_e_lp(52,45),_lp(52,45))
reg("leg-press-articulado",["quadriceps","gluteo"],(70,10,-.22,5.0),_e_lp(40,30),_lp(40,30))
reg("leg-press-horizontal",["quadriceps","gluteo"],(72,8,-.3,5.8),_e_lp(18,6),_lp(18,6))
reg("panturrilha-leg-press",["panturrilha"],(112,10,-.2,5.0),_e_lp(52,45),_lp(52,45,1.0))
reg("panturrilha-leg-press-isometria",["panturrilha"],(112,10,-.2,5.0),_e_lp(52,45),_lp(52,45,.35))
def _extensora(uni):
    def f(P,t):
        sentado(P,.12,G+.54,-4)
        h=Q(P,HIPC)
        for l,s in LADOS:
            u=t if (not uni or s>0) else 0
            Pe(P,s,lerp((s*.15,h.y-.5,G+.22),(s*.15,h.y-.86,h.z+.02),u),(s*.06,-.2,1),lerp((s*.08,-.9,-.4),(s*.08,-.4,.95),u))
            M_(P,s,(s*.29,.1,G+.62),(s*.6,.5,0),TN(s))
        P.resolve()
        for l,s in LADOS:
            if not uni or s>0:
                c=P.M["foot."+l].translation+V((0,.0,.08));
        k=(P.M["foot.L"].translation+V((-.15,.05,.06)));cil(k-V((.26,0,0)),k+V((.26,0,0)),.05,PAD,True);cil(k,V((0,.0,G+.62))+V((0,-.1,0)),.018,ACO,True)
    return f
def _e_ext():banco(.12,.46,G+.54);encosto((0,.12,G+.56),4,.72);caixa((.34,.1,G+.54),(.05,.42,.04));caixa((-.34,.1,G+.54),(.05,.42,.04))
reg("cadeira-extensora",["quadriceps"],(62,6,-.25,4.6),_e_ext,_extensora(False))
reg("cadeira-extensora-unilateral",["quadriceps"],(62,6,-.25,4.6),_e_ext,_extensora(True))
def _flex_sent(P,t):
    sentado(P,.12,G+.54,-6)
    h=Q(P,HIPC)
    for l,s in LADOS:
        Pe(P,s,lerp((s*.15,h.y-.86,h.z+.03),(s*.15,h.y-.34,G+.12),t),(s*.06,-.2,1),lerp((s*.08,-.4,.9),(s*.08,-1,-.5),t))
        M_(P,s,(s*.29,.1,G+.62),(s*.6,.5,0),TN(s))
    P.resolve();k=P.M["foot.L"].translation+V((-.15,.08,-.03));cil(k-V((.26,0,0)),k+V((.26,0,0)),.05,PAD,True);cil(k,(0,-.32,G+.36),.018,ACO,True)
    p=V((0,-.3,h.z+.12));caixa(p,(.5,.14,.06),PAD,True)
def _e_flex():_e_ext();caixa((0,-.32,G+.17),(.1,.1,.34))
reg("cadeira-flexora",["posterior"],(64,6,-.25,4.6),_e_flex,_flex_sent)
def _mesa(P,t):
    corpo(P,(0,.05,G+.68),90)
    h=Q(P,HIPC)
    for l,s in LADOS:
        Pe(P,s,lerp((s*.13,h.y+.86,h.z+.0),(s*.13,h.y+.5,h.z+.56),t),(s*.05,0,-1),lerp((s*.05,.4,-.9),(s*.05,1,.4),t))
        o=om(P,s);M_(P,s,o+V((s*.08,-.42,-.13)),(s*.4,.2,-1),TN(s))
    P.delta["neck01"]=q((1,0,0),-18);P.resolve()
    k=P.M["foot.L"].translation+V((-.13,.08,.08));cil(k-V((.26,0,0)),k+V((.26,0,0)),.05,PAD,True);cil(k,(0,.45,G+.52),.018,ACO,True)
def _e_mesa():
    caixa((0,-.05,G+.54),(.42,1.3,.08),PAD);caixa((0,.05,G+.25),(.16,.16,.5))
reg("mesa-flexora",["posterior"],(62,12,-.25,5.0),_e_mesa,_mesa)
def _flex_pe(P,t):
    corpo(P,HIPC+V((0,.05,0)),10)
    Pe(P,-1,(-.13,.05,G+.095),(-.08,-1,0))
    h=Q(P,_r["upperleg01.L"].translation)
    Pe(P,1,lerp((.13,h.y+.08,h.z-.84),(.13,h.y+.62,h.z-.3),t),(.05,-1,0),lerp((.05,-.9,-.5),(.05,.3,-.95),t))
    for l,s in LADOS:M_(P,s,(s*.2,-.42,.32),(s*.3,.6,-.8),TN(s))
    P.resolve();k=P.M["foot.L"].translation+V((0,.08,.05));cil(k-V((.08,0,0)),k+V((.08,0,0)),.05,PAD,True);caixa((0,-.5,G+.5),(.38,.1,1.0),CLA)
reg("flexora-em-pe",["posterior"],(118,6,-.1,5.0),nada,_flex_pe)
def _adut(abre):
    def f(P,t):
        sentado(P,.1,G+.54,-5);h=Q(P,HIPC)
        u=t if not abre else 1-t
        for l,s in LADOS:
            x=lerp((s*.48,0,0),(s*.1,0,0),u).x
            Pe(P,s,(x,h.y-.62,G+.3),(x*.5,-.5,1),(s*.05,-1,-.1));M_(P,s,(s*.29,.1,G+.62),(s*.6,.5,0),TN(s))
            c=P.alvos[("pe",l)][0]+V((s*.08,.2,.13))
        P.resolve()
        for l,s in LADOS:
            jo=(P.M["lowerleg01."+l].translation);caixa(jo+V((s*.09,.0,.02)),(.05,.22,.2),PAD,True)
    return f
def _e_adut():banco(.1,.46,G+.54);encosto((0,.1,G+.56),5,.72)
reg("cadeira-adutora",["adutor"],(8,14,-.2,4.6),_e_adut,_adut(False))
reg("cadeira-abdutora",["abdutor","gluteo"],(38,10,-.2,4.6),_e_adut,_adut(True))
def _stiff(tp):
    def f(P,t):
        lean=lerp((0,0,4),(0,0,74),1-t).z
        h=HIPC+V((0,.02+.16*(1-t),-.02*(1-t)));corpo(P,h,lean)
        for l,s in LADOS:
            Pe(P,s,(s*.14,0,G+.095),(s*.06,-1,0));o=om(P,s);M_(P,s,o+V((s*.0,-.03,-.52)),(s*.2,1,.2),TP(s) if tp!="halter" else TN(s))
        P.delta["neck01"]=q((1,0,0),-lean*.5);P.resolve()
        if tp=="barra":barra(P,.6,.12)
        elif tp=="halter":halteres(P,(1,0,0))
        elif tp=="maq":
            for l,s in LADOS:
                m=centro_mao(P,l);tubo(m,(s*.3,-.6,G+.1),.03,ACO,True)
    return f
CST=(118,6,-.15,5.0)
reg("stiff-barra",["posterior","gluteo"],CST,nada,_stiff("barra"))
reg("stiff-halteres",["posterior","gluteo"],CST,nada,_stiff("halter"))
reg("stiff-maquina",["posterior","gluteo"],CST,nada,_stiff("maq"))
def _terra(P,t):
    u=1-t;h=lerp(HIPC,(0,.26,G+.52),u);corpo(P,h,lerp((0,0,0),(0,0,62),u).z)
    for l,s in LADOS:
        Pe(P,s,(s*.15,0,G+.095),(s*.15,-1,.1));o=om(P,s);M_(P,s,o+V((s*.0,-.03,-.52)),(s*.2,1,.2),TP(s))
    P.delta["neck01"]=q((1,0,0),-30*u);P.resolve();barra(P,.6,.17)
reg("levantamento-terra",["posterior","gluteo","dorsal"],CST,nada,_terra)
def _afundo(bulg=False,halt=True):
    def f(P,t):
        u=1-t;hz=lerp(HIPC,(0,0,G+.56),u).z-(.0);corpo(P,(0,.08,hz),6)
        Pe(P,1,(.13,-.42,G+.095),(.08,-1,.1))
        if bulg:Pe(P,-1,(-.13,.72,G+.62),(-.05,-1,-.3),(-.05,.95,.3))
        else:Pe(P,-1,(-.13,.62,G+.16),(-.05,-1,-.4),(-.05,-.3,-1))
        for l,s in LADOS:
            o=om(P,s)
            if halt:M_(P,s,o+V((s*.05,0,-.5)),(s*.2,1,-.2),TN(s))
            else:M_(P,s,o+V((-s*.14,-.12,-.42)),(s*.5,.5,-.6),TN(s))
        P.resolve()
        if halt:halteres(P,(0,1,0))
    return f
def _e_bulg():caixa((0,.86,G+.28),(.42,.4,.5),PAD)
reg("afundo-halteres",["quadriceps","gluteo"],(62,6,-.05,5.0),nada,_afundo())
reg("afundo-sem-peso",["quadriceps","gluteo"],(62,6,-.05,5.0),nada,_afundo(False,False))
reg("agachamento-bulgaro",["quadriceps","gluteo"],(62,6,-.05,5.0),_e_bulg,_afundo(True))
def _ponte(banco_):
    def f(P,t):
        ah=(G+.5) if banco_ else (G+.1)
        z=lerp((0,0,ah-.0+(.0 if banco_ else .03)),(0,0,G+.5+(.15 if banco_ else -.08)),t).z if banco_ else lerp((0,0,G+.12),(0,0,G+.4),t).z
        corpo(P,(0,0,z),-90+(0 if not banco_ else 10)-(0 if banco_ else 0) if banco_ else lerp((0,0,-90),(0,0,-72),t).z)
        for l,s in LADOS:
            Pe(P,s,(s*.16,-.42,G+.095),(s*.08,-.2,1),(s*.1,-1,-.4))
            M_(P,s,(s*.28,.28,(G+.05) if not banco_ else G+.4),(s*.6,.3,.0),TP(s))
        P.resolve()
        if banco_:barra(P,.0001,0) if False else None
    return f
def _e_pelv():caixa((0,.42,G+.22),(.8,.34,.44),PAD)
reg("ponte-gluteo",["gluteo"],(68,8,-.5,4.2),nada,_ponte(False))
def _pelv(P,t):
    z=lerp((0,0,G+.28),(0,0,G+.6),t).z;corpo(P,(0,-.02,z),lerp((0,0,-40),(0,0,-85),t).z)
    for l,s in LADOS:
        Pe(P,s,(s*.17,-.5,G+.095),(s*.1,-.3,1),(s*.1,-1,-.4))
        M_(P,s,(s*.3,-.05,z+.13),(s*.5,.3,.7),TP(s))
    P.delta["neck01"]=q((1,0,0),25);P.resolve();c=(fim(P,"L")+fim(P,"R"))/2+V((0,0,.04));cil(c-V((.6,0,0)),c+V((.6,0,0)),.014,ACO,True)
    for s in(-1,1):cil(c+V((s*.46,0,0)),c+V((s*.53,0,0)),.15,ESC,True)
reg("elevacao-pelvica",["gluteo"],(68,8,-.45,4.6),_e_pelv,_pelv)
def _cal_sent(P,t):
    corpo(P,(0,.2,G+.46+.125));az=G+.135+.075*t
    for l,s in LADOS:
        Pe(P,s,(s*.14,-.26,az),(s*.05,-1,.4),lerp((s*.05,-.85,.38),(s*.05,-.8,-.55),t))
        M_(P,s,(s*.19,-.02,G+.66+.03*t),(s*.7,.5,-.5),s*-50)
    P.resolve();a=(P.M["lowerleg01.L"].translation+P.M["lowerleg01.R"].translation)/2
    caixa(a+V((0,.1,.08)),(.46,.2,.07),PAD,True);tubo(a+V((-.3,.1,.08)),(-.3,-.1,G+.56),.03,ACO,True)
def _e_cal():
    banco(.2,.5,G+.46);caixa((0,-.34,G+.06),(.5,.24,.12),ESC);tubo((-.28,.2,G+.05),(-.28,-.34,G+.05),.05);tubo((-.3,.1,G+.05),(-.3,-.1,G+.56),.05)
reg("panturrilha-sentado",["panturrilha"],(116,6,-.2,4.7),_e_cal,_cal_sent)
def _cal_pe(deg):
    def f(P,t):
        dz=.075*t;corpo(P,HIPC+V((0,.0,dz)),0)
        for l,s in LADOS:
            Pe(P,s,(s*.13,0,G+.2+dz),(s*.08,-1,0),lerp((s*.08,-1,.08),(s*.08,-.7,-.72),t))
            M_(P,s,(s*.3,-.02,.67+dz),(s*.6,.5,-.6),TN(s)) if not deg else M_(P,s,(s*.26,-.04,.08+dz),(s*.1,1,-1),TN(s))
        P.resolve()
        if not deg:
            c=P.M["neck01"].translation+V((0,.05,-.03));caixa(c+V((.2,0,0)),(.2,.2,.07),PAD,True);caixa(c-V((.2,0,0)),(.2,.2,.07),PAD,True)
    return f
def _e_calp():caixa((0,-.2,G+.06),(.56,.24,.12),ESC)
reg("panturrilha-em-pe",["panturrilha"],(150,6,-.05,5.0),_e_calp,_cal_pe(False))
reg("panturrilha-degrau",["panturrilha"],(150,6,-.05,5.0),_e_calp,_cal_pe(True))
# ======== ABDOMEN E LOMBAR ========
def _crunch(sobre_banco):
    def f(P,t):
        z=(G+.56) if sobre_banco else (G+.12)
        corpo(P,(0,-.02,z),-90)
        for l,s in LADOS:
            Pe(P,s,(s*.14,-.46,G+.095 if not sobre_banco else G+.095),(s*.08,-.2,1),(s*.1,-1,-.3))
            o=om(P,s);M_(P,s,o+V((-s*.06,-.2,.15))+V((0,-.28*t,.2*t)),(s*.7,.3,.4),TN(s))
        for n,a in (("spine04",7),("spine03",12),("spine02",12),("spine01",8),("neck01",6)):P.delta[n]=q((1,0,0),a*t)
        P.resolve()
    return f
reg("abdominal-banco",["abdomen"],(68,8,-.3,4.6),_e_deit,_crunch(True))
reg("abdominal-solo",["abdomen"],(68,8,-.55,4.1),nada,_crunch(False))
def _ab_maq(P,t):
    sentado(P,.12,G+.5,-6)
    for n,a in (("spine04",9),("spine03",14),("spine02",14),("spine01",9),("neck01",6)):P.delta[n]=q((1,0,0),a*t)
    for l,s in LADOS:M_(P,s,lerp((s*.14,-.14,G+1.27),(s*.14,-.42,G+1.0),t),(s*.7,.5,.2),TN(s))
    P.resolve()
    for l,s in LADOS:
        h=centro_mao(P,l);cil(h-V((.03,0,0)),h+V((.03,0,0)),.016,ACO,True);tubo(h,(s*.32,.32,G+1.2),.03,ACO,True)
def _e_abm():banco(.12,.44,G+.5);encosto((0,.12,G+.5),6,.8);caixa((0,.32,G+.65),(.74,.08,1.3),CLA)
reg("abdominal-maquina",["abdomen"],(62,6,-.1,4.8),_e_abm,_ab_maq)
def _ab_cabo(P,t):
    corpo(P,(0,.05,G+.22),4)
    for s in(1,-1):
        Pe(P,s,(s*.14,.38,G+.1),(s*.05,-1,-.1),(s*.05,.95,.2))
    for n,a in (("spine04",10),("spine03",14),("spine02",14),("spine01",10),("neck01",8)):P.delta[n]=q((1,0,0),a*t)
    for l,s in LADOS:M_(P,s,None or (Q(P,_r["neck01"].translation)+V((s*.07,-.12-.34*t,.04-.24*t))),(s*.7,.4,.2),TN(s))
    P.resolve();a,b=centro_mao(P,"L"),centro_mao(P,"R");n=(a+b)/2+V((0,-.05,.1));cil(a,n,.011,CABO,True);cil(b,n,.011,CABO,True);cabo(n,_alto)
reg("abdominal-cabo",["abdomen"],(60,6,-.1,5.2),_ccol,_ab_cabo)
def _prancha(joelho=False,lateral=False):
    def f(P,t):
        dz=.006*math.sin(t*3.14)
        if joelho:
            corpo(P,(0,.15,G+.36+dz),74)
            for l,s in LADOS:Pe(P,s,(s*.1,.5,G+.18),(s*.05,0,-1),(s*.05,1,.1))
        else:
            corpo(P,(0,.12,G+.42+dz),84)
            for l,s in LADOS:Pe(P,s,(s*.1,.95,G+.16),(s*.05,0,1),(s*.05,-.2,-1))
        for l,s in LADOS:
            o=om(P,s);M_(P,s,(s*.1,o.y-.27,G+.1),(s*.25,.5,-1),TN(s),(0,-1,.1))
        P.delta["neck01"]=q((1,0,0),-16);P.resolve()
    return f
reg("prancha",["abdomen"],(52,-7,-.5,4.9),nada,_prancha())
reg("prancha-joelhos",["abdomen"],(52,-7,-.5,4.6),nada,_prancha(True))
def _pr_lat(P,t):
    dz=.006*math.sin(t*3.14);P.base=q((0,1,0),-78);P.loc=V((0,0,G+.42+dz))-ROOT-P.base@(HIPC-ROOT)
    s0=-1
    for l,s in LADOS:Pe(P,s,(.86,s*.08,G+.09),(.1,-1,.0),(.2,-1,.1))
    M_(P,-1,(-.42,-.26,G+.08),(-.1,-.1,-1),TN(-1),(0,-1,.1));M_(P,1,(-.45,0,.15),(.2,.0,1),TN(1))
    P.resolve()
reg("prancha-lateral",["abdomen"],(0,8,-.45,4.9),nada,_pr_lat)
def _el_pernas(P,t):
    corpo(P,(0,0,G+.12),-90)
    for l,s in LADOS:
        h=Q(P,_r["upperleg01."+l].translation);Pe(P,s,lerp((s*.11,-.84,G+.14),(s*.11,-.18,h.z+.82),t),(s*.05,-.2,.9),lerp((s*.05,-1,.3),(s*.05,-.9,-.3),t))
        M_(P,s,(s*.28,.15,G+.06),(s*.5,.2,.2),TP(s))
    P.resolve()
reg("elevacao-pernas",["abdomen"],(68,8,-.4,4.7),nada,_el_pernas)
def _bici(P,t):
    corpo(P,(0,0,G+.12),-90)
    for n,a in (("spine03",10),("spine02",10),("neck01",8)):P.delta[n]=q((1,0,0),a)
    for l,s in LADOS:
        u=t if s>0 else 1-t;h=Q(P,_r["upperleg01."+l].translation)
        Pe(P,s,lerp((s*.13,-.74,h.z+.2),(s*.13,-.32,h.z+.22),u),(s*.1,-.3,1),(s*.1,-.8,.2));o=om(P,s);M_(P,s,o+V((-s*.05,-.18,.2)),(s*.7,.3,.3),TN(s))
    P.resolve()
reg("bicicleta-solo",["abdomen"],(68,8,-.45,4.6),nada,_bici)
def _superman(P,t):
    corpo(P,(0,0,G+.11),90)
    P.delta["spine03"]=q((1,0,0),-10*t);P.delta["spine01"]=q((1,0,0),-10*t)
    for l,s in LADOS:
        h=Q(P,_r["upperleg01."+l].translation);Pe(P,s,lerp((s*.1,.85,G+.1),(s*.1,.8,G+.32),t),(s*.05,0,-1),(s*.05,1,.1))
        M_(P,s,lerp((s*.24,-1.02,G+.08),(s*.24,-.98,G+.34),t),(s*.1,0,1),TP(s))
    P.resolve()
reg("superman",["lombar","gluteo"],(62,8,-.5,5.0),nada,_superman)
def _bird(P,t):
    corpo(P,(0,.28,G+.5),90)
    Pe(P,-1,(-.12,.62,G+.08) if False else (-.12,.82,G+.1),(-.05,-.5,-1),(-.05,1,.2))
    k=Q(P,_r["upperleg01.L"].translation)
    Pe(P,1,lerp((.12,.78,G+.12),(.12,k.y+.86,k.z+.05),t),(.05,.0,-1),(.05,1,.1))
    o=om(P,-1);oL=om(P,1)
    M_(P,1,(.2,oL.y,G+.06),(.3,.5,.1),TP(1),(0,-.6,.1));M_(P,-1,lerp((-.2,o.y,G+.06),(-.2,o.y-.5,o.z+.1),t),(-.3,.3,.3),TP(-1))
    P.delta["neck01"]=q((1,0,0),-20);P.resolve()
reg("perdigueiro",["lombar","gluteo"],(64,8,-.4,4.9),nada,_bird)
def _ext_lomb(P,t):
    lean=lerp((0,0,82),(0,0,22),t).z;corpo(P,(0,.08,G+.72),lean)
    for l,s in LADOS:
        Pe(P,s,(s*.12,.62,G+.25),(s*.05,0,-1),(s*.05,-.3,-1));o=om(P,s);M_(P,s,o+P.base@V((-s*.07,-.22,-.14)),(s*.7,.4,-.1),TN(s))
    P.delta["neck01"]=q((1,0,0),-lean*.4);P.resolve()
def _e_extl():caixa((0,.12,G+.62),(.42,.42,.08),PAD,False,q((1,0,0),-25));caixa((0,.65,G+.2),(.34,.14,.08),PAD);tubo((0,.1,G),(0,.6,G+.14),.06);tubo((0,.15,G),(0,.15,G+.58),.06)
reg("extensao-lombar",["lombar","gluteo"],(62,8,-.15,4.9),_e_extl,_ext_lomb)
