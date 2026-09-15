from rig_fingers import *
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from PIL import Image
import io

def global_matrices(d,overrides=None):
    overrides=overrides or {};parents={c:i for i,n in enumerate(d['nodes']) for c in n.get('children',[])};cache={}
    def visit(i):
        if i in cache:return cache[i]
        n=d['nodes'][i];t=np.asarray(overrides.get((i,'translation'),n.get('translation',[0,0,0])))
        q=np.asarray(overrides.get((i,'rotation'),n.get('rotation',[0,0,0,1])))
        s=np.asarray(overrides.get((i,'scale'),n.get('scale',[1,1,1])))
        m=np.eye(4);m[:3,:3]=Rotation.from_quat(q).as_matrix()@np.diag(s);m[:3,3]=t
        if 'matrix' in n:m=np.asarray(n['matrix']).reshape(4,4).T
        cache[i]=visit(parents[i])@m if i in parents else m;return cache[i]
    return np.asarray([visit(i) for i in range(len(d['nodes']))])

def pose(d,b,clip=None,t=0):
    overrides={}
    if clip is not None:
        a=next(a for a in d['animations'] if a['name']==clip)
        for ch in a['channels']:
            s=a['samplers'][ch['sampler']];ts=accessor(d,b,s['input']).ravel();values=accessor(d,b,s['output'])
            k=np.clip(np.searchsorted(ts,t,side='right')-1,0,len(ts)-1);n=min(k+1,len(ts)-1)
            f=np.clip((t-ts[k])/max(ts[n]-ts[k],1e-8),0,1);v=values[k]*(1-f)+values[n]*f
            if ch['target']['path']=='rotation':v/=np.linalg.norm(v)
            overrides[(ch['target']['node'],ch['target']['path'])]=v
    g=global_matrices(d,overrides);skin=d['skins'][0]
    ib=accessor(d,b,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    mat=g[skin['joints']]@ib
    prim=d['meshes'][0]['primitives'][0];p=accessor(d,b,prim['attributes']['POSITION']);j=accessor(d,b,prim['attributes']['JOINTS_0']);w=accessor(d,b,prim['attributes']['WEIGHTS_0'])
    p4=np.column_stack([p,np.ones(len(p))]);out=np.zeros((len(p),4))
    for k in range(4):out+=np.einsum('nij,nj->ni',mat[j[:,k]],p4)*w[:,k,None]
    return out[:,:3],g

def hand_render(ax,d,b,p,side=1,title=''):
    original=accessor(d,b,0);faces=accessor(d,b,5).reshape(-1,3)
    faces=faces[np.all(side*original[faces,0]>.63,axis=1)]
    # Camera facing the palm with an oblique angle to show actual curl depth.
    u=np.array([side*.88,0,-.475]);v=np.array([side*-.1,.977,-.186]);depth=np.cross(u,v)*side
    xyz=p[faces];x=xyz@u;y=xyz@v;z=xyz@depth
    order=np.argsort(z.mean(1));verts=np.stack([x,y],axis=-1)
    normals=np.cross(xyz[:,1]-xyz[:,0],xyz[:,2]-xyz[:,0]);normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-10)
    light=np.array([side*.3,.5,.8]);light/=np.linalg.norm(light)
    shade=.35+.60*np.abs(normals@light)
    color=np.column_stack([shade*.82,shade*.91,shade,np.ones(len(shade))])
    ax.add_collection(PolyCollection(verts[order],facecolors=color[order],edgecolors='none',rasterized=True))
    # Fixed camera frame for consistent visual comparison across poses.
    center=np.array([side*.69,1.294,-.012]);cx=center@u;cy=center@v
    ax.set_xlim(cx-.11,cx+.11);ax.set_ylim(cy-.105,cy+.105);ax.set_aspect('equal');ax.axis('off');ax.set_title(title,color='#e6edf5',fontsize=13)

def main():
    d,b=read_glb((OUT/'Robot_OriginalMotion_FingerRig.glb').read_bytes());p=accessor(d,b,0)
    a=d['meshes'][0]['primitives'][0]['attributes'];w=accessor(d,b,a['WEIGHTS_0']);j=accessor(d,b,a['JOINTS_0'])
    assert np.isfinite(w).all() and np.all(w>=0) and np.max(abs(w.sum(1)-1))<1e-5
    assert j.max()<len(d['skins'][0]['joints'])
    opened,_=pose(d,b,'Hands_Open');fist,_=pose(d,b,'Hands_Fist');grip,_=pose(d,b,'Hands_GolfGrip_Preview')
    err=float(np.max(np.linalg.norm(opened-p,axis=1)));assert err<1e-5,err
    body=np.abs(p[:,0])<.60;bodyerr=float(np.max(np.linalg.norm(fist[body]-opened[body],axis=1)));assert bodyerr<1e-7,bodyerr
    stats={'total_skin_joints':len(d['skins'][0]['joints']),'new_finger_joints':30,'bind_pose_max_error_m':err,'body_motion_from_finger_clip_m':bodyerr,'weights_sum_max_error':float(abs(w.sum(1)-1).max()),'finger_tests':{},'original_clips_unchanged':True}
    meta=json.loads((OUT/'rig_metadata.json').read_text())['joints']
    for digit in DIGITS:
        pp,_=pose(d,b,'Test_'+digit,1.3)
        for side in ['Left','Right']:
            slots=[m['slot'] for m in meta if m['digit']==digit and m['side']==side]
            mask=np.any(np.isin(j,slots)&(w>.5),axis=1);delta=np.linalg.norm(pp[mask]-opened[mask],axis=1)
            assert len(delta)>20 and delta.max()>.005
            stats['finger_tests'][side+digit]={'weighted_vertices':int(mask.sum()),'max_displacement_m':float(delta.max())}
        other=[m['slot'] for m in meta if m['digit']!=digit]
        mask=np.any(np.isin(j,other)&(w>.999),axis=1)
        assert np.max(np.linalg.norm(pp[mask]-opened[mask],axis=1))<1e-7
    stats['body_animation_checks']={}
    with zipfile.ZipFile(SOURCE) as z:
        oldfiles=[read_glb(z.read(n)) for n in z.namelist()]
    filenames=['Robot_OriginalMotion_FingerRig.glb','Robot_Running_FingerRig.glb','Robot_Walking_FingerRig.glb']
    for index,filename in enumerate(filenames):
        dd,bb=read_glb((OUT/filename).read_bytes());assert len(dd['skins'][0]['joints'])==57
        old,oldb=oldfiles[index]
        assert old['animations']==dd['animations'][:len(old['animations'])]
        assert old['materials']==dd['materials'] and old['images']==dd['images']
        maxerr=0
        for an in old['animations']:
            for tm in [0,.3,.8]:
                op,_=pose(old,oldb,an['name'],tm);np_,_=pose(dd,bb,an['name'],tm)
                maxerr=max(maxerr,float(np.linalg.norm(op[body]-np_[body],axis=1).max()))
        assert maxerr<1e-6
        stats['body_animation_checks'][filename]={'max_body_vertex_error_m':maxerr,'preserved_original_clips':len(old['animations'])}
        for view in dd['bufferViews']:assert view.get('byteOffset',0)+view['byteLength']<=len(bb)
        for a in dd['animations']:
            for c in a['channels']:
                s=a['samplers'][c['sampler']];assert c['target']['node']<len(dd['nodes'])
                t=accessor(dd,bb,s['input']).ravel();v=accessor(dd,bb,s['output']);assert len(t)==len(v) and np.isfinite(v).all()
                assert np.all(np.diff(t)>0)
    (OUT/'validation.json').write_text(json.dumps(stats,indent=2))
    fig,axes=plt.subplots(2,3,figsize=(12,8),facecolor='#162130')
    for row,side in enumerate([1,-1]):
        for col,(pp,title) in enumerate([(opened,'OPEN'),(fist,'FIST'),(grip,'GRIP PREVIEW')]):hand_render(axes[row,col],d,b,pp,side,('LEFT / ' if side==1 else 'RIGHT / ')+title)
    fig.tight_layout();fig.savefig(OUT/'Hand_Pose_Check.png',dpi=150,facecolor=fig.get_facecolor());plt.close(fig)
    frames=[]
    for t in np.linspace(0,4,33):
        pp,_=pose(d,b,'Hands_OpenClose',t);fig,axes=plt.subplots(1,2,figsize=(8,4),facecolor='#162130')
        for ax,side in zip(axes,[1,-1]):hand_render(ax,d,b,pp,side,'LEFT HAND' if side==1 else 'RIGHT HAND')
        fig.tight_layout();buf=io.BytesIO();fig.savefig(buf,format='png',dpi=95,facecolor=fig.get_facecolor());plt.close(fig)
        frames.append(Image.open(buf).convert('RGB'))
    frames[0].save(OUT/'Hands_OpenClose_Preview.gif',save_all=True,append_images=frames[1:],duration=125,loop=0)
    print(json.dumps(stats,indent=2))
if __name__=='__main__':main()
