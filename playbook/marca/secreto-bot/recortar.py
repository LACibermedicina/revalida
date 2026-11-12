import cv2, numpy as np
exec(open('recortar-base.py').read().split("cv2.imwrite('mask.png'")[0])   # reaproveita sure/mask/fg/im
hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
allowed=cv2.dilate(sure,np.ones((27,27),np.uint8))
fg2=cv2.bitwise_and(fg,allowed)
# parede (cinza claro, pouca saturação) fora do balão e do jaleco
parede=((hsv[...,1]<26)&(hsv[...,2]>150)).astype(np.uint8)*255
balao=np.zeros((H,W),np.uint8); cv2.ellipse(balao,(130,190),(112,160),0,0,360,255,-1)
jaleco=np.zeros((H,W),np.uint8); cv2.fillPoly(jaleco,[np.array([(190,700),(330,625),(600,625),(680,640),(690,900),(600,1000),(340,1000),(300,900),(200,800)],np.int32)],255)
parede[balao>0]=0
parede=cv2.dilate(parede,np.ones((3,3),np.uint8))
protege=cv2.erode(sure,np.ones((17,17),np.uint8)); cv2.rectangle(protege,(418,60),(446,310),255,-1); protege[balao>0]=255
jal2=np.zeros((H,W),np.uint8); cv2.fillPoly(jal2,[np.array([(200,705),(330,630),(590,632),(640,655),(672,720),(675,900),(600,990),(340,990),(310,900),(215,800)],np.int32)],255); protege[jal2>0]=255
fg2[(parede>0)&(protege==0)]=0
# maior componente do corpo + balão + fio
n,lab,st,_=cv2.connectedComponentsWithStats(fg2)
keep=np.zeros_like(fg2)
for i in range(1,n):
    if st[i,cv2.CC_STAT_AREA]>1500: keep[lab==i]=255
fg2=keep
fg2=cv2.morphologyEx(fg2,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
fg2=cv2.erode(fg2,np.ones((3,3),np.uint8))
a=cv2.GaussianBlur(fg2,(5,5),0)
rgba=cv2.cvtColor(im,cv2.COLOR_BGR2BGRA); rgba[:,:,3]=a
# fio do balão: linha fina escura até a mão
fio=np.zeros((H,W),np.uint8); cv2.polylines(fio,[np.array([(128,352),(127,430),(124,520),(122,600),(121,654)],np.int32)],False,255,2,cv2.LINE_AA)
for c in range(3): rgba[:,:,c]=np.where(fio>0,28,rgba[:,:,c])
rgba[:,:,3]=np.maximum(rgba[:,:,3],fio)
ys,xs=np.where(rgba[:,:,3]>20); x0,x1,y0,y1=xs.min(),xs.max(),ys.min(),ys.max()
out=rgba[max(0,y0-6):y1+8,max(0,x0-6):x1+8]
cv2.imwrite('bot-cut.png',out); print(out.shape)
bg=np.full(out.shape[:2]+(3,),(150,190,160),np.uint8); al=out[:,:,3:4]/255.0
cv2.imwrite('prev2.png',(out[:,:,:3]*al+bg*(1-al)).astype(np.uint8))

# ---- pós-processo: manchas de parede à direita da cabeça e do ombro; separar balão e corpo; geometria
oh,ow=out.shape[:2]; offx=max(0,x0-6); offy=max(0,y0-6)
hs=cv2.cvtColor(out[:,:,:3],cv2.COLOR_BGR2HSV)
for (xa,xb,ya,yb) in [(595,690,400,585),(585,690,585,700)]:
    ra,rb,rc,rd=xa-offx,xb-offx,ya-offy,yb-offy
    sub=(hs[rc:rd,ra:rb,1]<34)&(hs[rc:rd,ra:rb,2]>120)
    out[rc:rd,ra:rb,3][sub]=0
n,lab,st,_=cv2.connectedComponentsWithStats((out[:,:,3]>10).astype(np.uint8))
k=np.zeros(out.shape[:2],np.uint8)
for i in range(1,n):
    if st[i,cv2.CC_STAT_AREA]>800: k[lab==i]=255
out[:,:,3]=np.where(k>0,out[:,:,3],0)
ba=out.copy(); co=out.copy()
yy,xx=np.mgrid[0:oh,0:ow]; gx=xx+offx; gy=yy+offy
zona=(gx<245)&(gy<632)
ba[:,:,3]=np.where(zona,out[:,:,3],0); co[:,:,3]=np.where(zona,0,out[:,:,3])
S=560/ow
def red(a): return cv2.resize(a,(560,int(oh*S)),interpolation=cv2.INTER_AREA)
cv2.imwrite('corpo.png',red(co)); cv2.imwrite('balao.png',red(ba)); cv2.imwrite('inteiro.png',red(out))
g=dict(W=560,H=int(oh*S),offx=int(offx),offy=int(offy),S=S)
import json; print(json.dumps(g))
bg=np.full(out.shape[:2]+(3,),(150,190,160),np.uint8); al=out[:,:,3:4]/255.0
cv2.imwrite('prev3.png',(out[:,:,:3]*al+bg*(1-al)).astype(np.uint8))
