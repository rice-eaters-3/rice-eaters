"""Register expression edits to one canonical portrait and pack without moving features.
Build-time dependencies: Pillow, numpy, opencv-python-headless. Runtime stays Node-only.
"""
import argparse,hashlib,json,pathlib
import cv2
import numpy as np
from PIL import Image

PROFILES={
 'nari':{'name':'Nari','eyes':[[404,284,501,350],[542,282,638,349]],'mouth':[474,376,578,431],'face':[370,230,680,450],'neck':[440,555],'pivot':[512,500]},
 'ruri':{'name':'Ruri','eyes':[[398,276,500,354],[541,276,644,354]],'mouth':[486,372,568,424],'face':[365,225,685,450],'neck':[440,565],'pivot':[512,500]},
 'miel':{'name':'Miel','eyes':[[372,292,500,382],[542,292,670,382]],'mouth':[472,398,574,456],'face':[340,250,700,480],'neck':[470,580],'pivot':[512,520]},
}
def gray(image):
 a=np.array(image);rgb=a[:,:,:3].astype(np.float32)*a[:,:,3:4]/255+255*(1-a[:,:,3:4]/255)
 return cv2.cvtColor(rgb.astype('uint8'),cv2.COLOR_RGB2GRAY)

def align(master,moving,profile):
 w,h=master.size;moving=moving.resize((w,h),Image.Resampling.LANCZOS);reference=gray(master);target=gray(moving)
 mask=np.zeros((h,w),dtype='uint8');mask[40:profile['neck'][1],200:w-200]=255;mask[np.array(master)[:,:,3]<240]=0
 for roi in [*profile['eyes'],profile['mouth']]:
  l,t,r,b=roi;mask[max(0,t-18):min(h,b+18),max(0,l-18):min(w,r+18)]=0
 sift=cv2.SIFT_create(nfeatures=3000);k1,d1=sift.detectAndCompute(reference,mask);k2,d2=sift.detectAndCompute(target,mask)
 if d1 is None or d2 is None:raise ValueError('Not enough stable facial detail to register expression')
 pairs=cv2.BFMatcher().knnMatch(d2,d1,k=2);matches=[a for pair in pairs if len(pair)==2 for a,b in [pair] if a.distance<.72*b.distance]
 if len(matches)<12:raise ValueError('Expression identity changed too much to register safely')
 src=np.float32([k2[m.queryIdx].pt for m in matches]);dst=np.float32([k1[m.trainIdx].pt for m in matches]);matrix,inliers=cv2.estimateAffinePartial2D(src,dst,method=cv2.RANSAC,ransacReprojThreshold=2,maxIters=3000)
 if matrix is None or int(inliers.sum())<10:raise ValueError('Expression registration failed')
 scale=float(np.linalg.norm(matrix[0,:2]));error=np.linalg.norm(cv2.transform(src[:,None,:],matrix)[:,0,:]-dst,axis=1)[inliers[:,0].astype(bool)]
 if not .96<scale<1.04 or np.max(np.abs(matrix[:,2]))>32 or float(np.median(error))>1.5:raise ValueError('Expression drift exceeds safe alignment bounds')
 registered=cv2.warpAffine(np.array(moving),matrix,(w,h),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
 return Image.fromarray(registered),{'matrix':matrix.tolist(),'matches':len(matches),'inliers':int(inliers.sum()),'medianErrorPx':float(np.median(error)),'scale':scale}

def prepare(identity,input_dir,output_dir):
 p=PROFILES[identity];master=Image.open(input_dir/'master.png').convert('RGBA');w,h=master.size
 if (w,h)!=(1024,1536):raise ValueError('Canonical portrait must be 1024x1536; never resize individual features')
 blink,blink_report=align(master,Image.open(input_dir/'blink.png').convert('RGBA'),p);talk,talk_report=align(master,Image.open(input_dir/'talk.png').convert('RGBA'),p)
 atlas=Image.new('RGBA',(2048,2048));raw=np.array(master);padding=np.pad(raw,((8,8),(8,8),(0,0)),mode='edge');atlas.paste(Image.fromarray(padding),(0,0))
 patches={};reports={};x=1064;y=32
 for key,roi,image in [('EyeLClosed',p['eyes'][0],blink),('EyeRClosed',p['eyes'][1],blink),('MouthOpen',p['mouth'],talk)]:
  l,t,r,b=roi;part=np.array(image.crop(roi));original=np.array(master.crop(roi));ph,pw=part.shape[:2];yy,xx=np.mgrid[:ph,:pw];edge=np.minimum.reduce([xx,yy,pw-1-xx,ph-1-yy]).astype(float);feather=np.clip(edge/10,0,1);feather=feather*feather*(3-2*feather)
  stable=(edge<7)&(original[:,:,3]>240);difference=np.abs(part[:,:,:3].astype(float)-original[:,:,:3]);rim=float(difference[stable].mean()) if stable.any() else 0
  if rim>18:raise ValueError(key+' expression border does not match canonical skin/hair')
  if int(original[:,:,3].min())<220 or int(part[:,:,3].min())<220:raise ValueError(key+' expression ROI extends outside the painted face')
  part[:,:,3]=np.rint(255*feather).astype('uint8');atlas.paste(Image.fromarray(part),(x,y));patches[key]={'target':roi,'source':[x,y,x+pw,y+ph]};reports[key]={'rimMeanDifference':rim,'featherPx':10};y+=ph+32
 meta={'name':p['name'],'preset':identity,'canvas':[w,h],'atlas':[2048,2048],'face':p['face'],'neck':p['neck'],'pivot':p['pivot'],'mouth':p['mouth'],'patches':patches,'reference':{'rect':[8,8,w+8,h+8],'rgbaSha256':hashlib.sha256(raw.tobytes()).hexdigest()},'registration':{'blink':blink_report,'talk':talk_report,'patches':reports},'steamVTubeStudioVerified':False}
 output_dir.mkdir(parents=True,exist_ok=True);(output_dir/'textures').mkdir(exist_ok=True)
 atlas.save(output_dir/'textures/texture_00.png',icc_profile=master.info.get('icc_profile'))
 (output_dir/'registration.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(json.dumps({'model':identity,'blink':blink_report,'talk':talk_report,'patches':reports}))

if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('identity',choices=PROFILES);a.add_argument('input_dir',type=pathlib.Path);a.add_argument('output_dir',type=pathlib.Path);args=a.parse_args();prepare(args.identity,args.input_dir,args.output_dir)
