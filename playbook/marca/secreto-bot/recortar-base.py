import cv2, numpy as np
im=cv2.imread('foto-referencia-jaleco.png')
H,W=im.shape[:2]; im=im[:1100]; H=1100
sure=np.zeros((H,W),np.uint8)
def poly(pts): cv2.fillPoly(sure,[np.array(pts,np.int32)],255)
# cubo da cabeça + antena
poly([(250,300),(640,300),(648,600),(600,612),(290,612),(248,590)])
cv2.rectangle(sure,(424,70),(440,300),255,-1)
# balão (elipse) e fio
cv2.ellipse(sure,(130,190),(100,148),0,0,360,255,-1)
cv2.line(sure,(128,350),(120,660),255,3)
# mão esquerda e tronco/jaleco
poly([(85,660),(160,655),(170,735),(150,775),(95,775),(80,720)])
poly([(190,700),(330,625),(600,625),(680,640),(690,900),(600,1000),(340,1000),(300,900),(200,800)])
# pés
poly([(70,900),(260,880),(330,960),(300,1055),(100,1050),(60,980)])
poly([(335,930),(480,920),(490,1010),(440,1060),(350,1050),(325,990)])
cv2.ellipse(sure,(635,960),(45,55),0,0,360,255,-1)
prob=cv2.dilate(sure,np.ones((51,51),np.uint8))
mask=np.full((H,W),cv2.GC_BGD,np.uint8)
mask[prob>0]=cv2.GC_PR_BGD
mask[cv2.dilate(sure,np.ones((21,21),np.uint8))>0]=cv2.GC_PR_FGD
mask[cv2.erode(sure,np.ones((9,9),np.uint8))>0]=cv2.GC_FGD
bgd=np.zeros((1,65)); fgd=np.zeros((1,65))
cv2.grabCut(im,mask,None,bgd,fgd,8,cv2.GC_INIT_WITH_MASK)
fg=((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD)).astype(np.uint8)*255
fg=cv2.morphologyEx(fg,cv2.MORPH_OPEN,np.ones((3,3),np.uint8)); fg=cv2.morphologyEx(fg,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
cv2.imwrite('mask.png',fg)
a=cv2.GaussianBlur(fg,(5,5),0)
rgba=cv2.cvtColor(im,cv2.COLOR_BGR2BGRA); rgba[:,:,3]=a
cv2.imwrite('bot-cut.png',rgba)
bg=np.full((H,W,3),(60,150,130),np.uint8)
comp=(im*(a[...,None]/255.0)+bg*(1-a[...,None]/255.0)).astype(np.uint8)
cv2.imwrite('prev.png',comp)
