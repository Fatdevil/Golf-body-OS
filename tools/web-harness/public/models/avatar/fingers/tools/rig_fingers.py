"""Add a fitted finger rig to the supplied Meshy GLBs; preserves binary source data.
No Blender dependency. Coordinates below are fitted to this model, not universal.
"""
from inspect_rig import ROOT,SOURCE,read_glb,accessor
import numpy as np
from scipy.spatial.transform import Rotation
import json,struct,zipfile,copy

OUT=ROOT/'finger_rig_output'
DIGITS={
 'Thumb': [[.647,1.315,-.037],[.657,1.337,-.036],[.667,1.354,-.034],[.674,1.369,-.034]],
 'Index': [[.682,1.310,-.042],[.721,1.318,-.041],[.750,1.325,-.037],[.776,1.329,-.033]],
 'Middle':[[.688,1.291,-.043],[.729,1.291,-.042],[.759,1.290,-.036],[.783,1.289,-.032]],
 'Ring':  [[.683,1.270,-.043],[.720,1.265,-.041],[.750,1.260,-.036],[.777,1.256,-.032]],
 'Pinky': [[.676,1.252,-.042],[.707,1.241,-.040],[.731,1.232,-.035],[.750,1.227,-.032]],
}

def append_acc(d,b,a,kind,component=5126):
    a=np.asarray(a,dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[component])
    b.extend(b'\0'*((-len(b))%4)); off=len(b); payload=a.tobytes();b.extend(payload)
    bv=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(payload)})
    acc={'bufferView':bv,'componentType':component,'count':len(a),'type':kind}
    if kind=='SCALAR':acc.update(min=[float(a.min())],max=[float(a.max())])
    d['accessors'].append(acc);return len(d['accessors'])-1

def save_glb(d,b,path):
    d['buffers']=[{'byteLength':len(b)}]
    js=json.dumps(d,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    payload=bytes(b)+b'\0'*((-len(b))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(js)+len(payload))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(payload),0x004e4942)+payload)

def trs(m):
    return {'translation':m[:3,3].tolist(),'rotation':Rotation.from_matrix(m[:3,:3]).as_quat().tolist()}

def fit(d,b):
    skin=d['skins'][0]; origj=list(skin['joints'])
    ib=accessor(d,b,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    binds=list(np.linalg.inv(ib)); invs=list(ib)
    p=accessor(d,b,0);j=accessor(d,b,3).astype(np.uint16);w=accessor(d,b,4)
    metadata=[]; report={}
    for side,sign in [('Left',1),('Right',-1)]:
        hand=next(i for i,n in enumerate(d['nodes']) if n['name']==f'mixamorig:{side}Hand')
        hslot=origj.index(hand); hb=binds[hslot]
        # Both hands share virtually mirrored geometry in this mesh's bind pose.
        paths={name:np.asarray(points)*[sign,1,1] for name,points in DIGITS.items()}
        chains={}
        for name,points in paths.items():
            parent=hand;parent_bind=hb;chain=[]
            for k in range(3):
                direction=points[k+1]-points[k];direction/=np.linalg.norm(direction)
                axis=np.cross(direction,[0,0,1]);axis/=np.linalg.norm(axis)
                normal=np.cross(axis,direction)
                wb=np.eye(4);wb[:3,:3]=np.column_stack([axis,direction,normal]);wb[:3,3]=points[k]
                local=np.linalg.inv(parent_bind)@wb
                node={'name':f'mixamorig:{side}Hand{name}{k+1}',**trs(local),'extras':{'fingerRig':'v1','digit':name,'phalange':k+1}}
                ni=len(d['nodes']);d['nodes'].append(node);d['nodes'][parent].setdefault('children',[]).append(ni)
                slot=len(skin['joints']);skin['joints'].append(ni);binds.append(wb);invs.append(np.linalg.inv(wb))
                record={'side':side,'digit':name,'segment':k,'node':ni,'slot':slot,'rest_quat':node['rotation'],'bind':wb.tolist()}
                metadata.append(record);chain.append(slot);parent=ni;parent_bind=wb
            tip={'name':f'{side}Hand{name}Tip','translation':(np.linalg.inv(parent_bind)@np.r_[points[3],1])[:3].tolist()}
            ti=len(d['nodes']);d['nodes'].append(tip);d['nodes'][parent].setdefault('children',[]).append(ti)
            chains[name]=chain
        # Assign finger membership using nearest fitted centreline in the palm plane.
        candidates=np.flatnonzero((sign*p[:,0]>.625)&(p[:,1]>1.20)&(p[:,1]<1.39))
        pts=p[candidates];dist=[];along=[];lengths=[]
        for name,points in paths.items():
            dv=points[-1,:2]-points[0,:2];length=np.linalg.norm(dv);u=dv/length
            t=(pts[:,:2]-points[0,:2])@u
            closest=points[0,:2]+np.clip(t,0,length)[:,None]*u
            dist.append(np.linalg.norm(pts[:,:2]-closest,axis=1));along.append(t);lengths.append(length)
        dist=np.stack(dist,1);along=np.stack(along,1);owner=np.argmin(dist,axis=1)
        for fi,(name,points) in enumerate(paths.items()):
            pick=(owner==fi)&(dist[:,fi]<.024)&(along[:,fi]>-.016)
            ids=candidates[pick];v=p[ids]
            direction=points[-1]-points[0];direction/=np.linalg.norm(direction)
            t=(v-points[0])@direction; stations=(points-points[0])@direction
            # Rigid phalanges with a small smooth blend on each bending joint.
            W=np.zeros((len(ids),3));W[:,0]=1
            for k in [1,2]:
                blend=np.clip((t-stations[k]+.005)/.010,0,1);blend=blend*blend*(3-2*blend)
                W[:,:k]*=(1-blend[:,None]);W[:,k]=blend
            attach=np.clip((t+.013)/.024,0,1);attach=attach*attach*(3-2*attach)
            W*=attach[:,None]
            for row,idx in enumerate(ids):
                weights={}
                for oldslot,weight in zip(j[idx],w[idx]):
                    weights[int(oldslot)]=weights.get(int(oldslot),0)+float(weight*(1-attach[row]))
                for slot,weight in zip(chains[name],W[row]): weights[slot]=float(weight)
                entries=sorted(weights.items(),key=lambda z:z[1],reverse=True)[:4]
                j[idx]=0;w[idx]=0
                for k,(slot,weight) in enumerate(entries):j[idx,k]=slot;w[idx,k]=weight
                w[idx]/=w[idx].sum()
            report[f'{side}{name}']={'vertices':len(ids),'max_attachment':float(attach.max()),'slots':chains[name]}
    prim=d['meshes'][0]['primitives'][0]
    prim['attributes']['JOINTS_0']=append_acc(d,b,j,'VEC4',5123)
    prim['attributes']['WEIGHTS_0']=append_acc(d,b,w,'VEC4')
    skin['inverseBindMatrices']=append_acc(d,b,np.asarray(invs).transpose(0,2,1).reshape(-1,16),'MAT4')
    # Full-body bind transforms for self-contained hand demonstration clips.
    parents={c:i for i,n in enumerate(d['nodes']) for c in n.get('children',[])}
    bind_by_node={node:binds[i] for i,node in enumerate(skin['joints'])}
    rest={}
    for node in origj:
        par=parents.get(node);base=bind_by_node.get(par,np.eye(4));rest[node]=trs(np.linalg.inv(base)@bind_by_node[node])
    return metadata,rest,report

def add_clips(d,b,meta,rest):
    def clip(name,times,amounts,style='curl',single=None):
        a={'name':name,'samplers':[],'channels':[],'extras':{'purpose':'Hand rig demonstration. Golf grip is a starting pose, not fitted to a club.'}}
        ta=append_acc(d,b,np.asarray(times)[:,None],'SCALAR')
        def track(node,path,values):
            ai=append_acc(d,b,values,'VEC4' if path=='rotation' else 'VEC3');si=len(a['samplers'])
            a['samplers'].append({'input':ta,'output':ai,'interpolation':'LINEAR'});a['channels'].append({'sampler':si,'target':{'node':node,'path':path}})
        for node,tr in rest.items():
            for path in ['translation','rotation']:track(node,path,[tr[path]]*len(times))
        for m in meta:
            digit=m['digit'];k=m['segment'];base=Rotation.from_quat(m['rest_quat'])
            angle=([38,55,42] if digit=='Thumb' else [65,88,62])[k]
            if style=='grip':angle=([35,40,32] if digit=='Thumb' else [46,64,44])[k]
            values=[]
            for amt in amounts:
                amt=amt if single is None or single==digit else 0
                r=Rotation.from_rotvec([np.deg2rad(angle)*amt,0,0])
                if digit=='Thumb' and k==0:
                    # Thumb opposition at base; smaller than full anatomical opposition.
                    r=Rotation.from_rotvec([0,0,np.deg2rad(-18)*amt])*r
                values.append((base*r).as_quat())
            track(m['node'],'rotation',values)
        d.setdefault('animations',[]).append(a)
    clip('Hands_Open',[0,1],[0,0])
    clip('Hands_OpenClose',[0,.6,1.6,2.3,3.3,4],[0,0,1,1,0,0])
    clip('Hands_Fist',[0,1],[1,1])
    clip('Hands_GolfGrip_Preview',[0,1],[1,1],style='grip')
    for digit in DIGITS:clip('Test_'+digit,[0,.4,1.2,1.7,2.5],[0,0,1,1,0],single=digit)
    # Optional overlays only target the new finger joints, never the body.
    finger_nodes={m['node'] for m in meta}
    for original,name in [('Hands_OpenClose','FingersOnly_OpenClose'),('Hands_GolfGrip_Preview','FingersOnly_GolfGrip')]:
        overlay=copy.deepcopy(next(a for a in d['animations'] if a['name']==original));overlay['name']=name
        overlay['channels']=[c for c in overlay['channels'] if c['target']['node'] in finger_nodes]
        used=sorted({c['sampler'] for c in overlay['channels']});remap={s:i for i,s in enumerate(used)}
        overlay['samplers']=[overlay['samplers'][i] for i in used]
        for c in overlay['channels']:c['sampler']=remap[c['sampler']]
        d['animations'].append(overlay)

def build():
    OUT.mkdir(exist_ok=True);allreport={}
    with zipfile.ZipFile(SOURCE) as z:
        for index,name in enumerate(z.namelist()):
            d,b=read_glb(z.read(name)); originals=copy.deepcopy(d.get('animations',[]));meta,rest,report=fit(d,b);add_clips(d,b,meta,rest)
            assert d['animations'][:len(originals)]==originals
            fn=['Robot_OriginalMotion_FingerRig.glb','Robot_Running_FingerRig.glb','Robot_Walking_FingerRig.glb'][index]
            save_glb(d,b,OUT/fn);allreport[fn]=report
            if index==0:(OUT/'rig_metadata.json').write_text(json.dumps({'joints':meta,'rest':rest},indent=2))
            print('WROTE',fn,'joints',len(d['skins'][0]['joints']),'clips',len(d['animations']),flush=True)
    (OUT/'build_report.json').write_text(json.dumps(allreport,indent=2))
if __name__=='__main__':build()
