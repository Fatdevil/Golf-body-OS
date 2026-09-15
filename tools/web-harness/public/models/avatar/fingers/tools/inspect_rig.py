import json, struct, zipfile
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).parent
SOURCE=ROOT/'upload/Meshy_AI_Neon_Embrace_biped.zip'
def read_glb(b):
    n=struct.unpack_from('<I',b,12)[0]
    return json.loads(b[20:20+n]), bytearray(b[28+n:])
def accessor(d,b,i):
    a=d['accessors'][i]; v=d['bufferViews'][a['bufferView']]
    ty={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
    cols={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    off=v.get('byteOffset',0)+a.get('byteOffset',0)
    return np.ndarray((a['count'],cols),dtype=ty,buffer=b,offset=off,strides=(v.get('byteStride',np.dtype(ty).itemsize*cols),np.dtype(ty).itemsize)).copy()
def source():
    with zipfile.ZipFile(SOURCE) as z: return read_glb(z.read(z.namelist()[0]))
if __name__=='__main__':
    d,b=source(); p=accessor(d,b,0); j=accessor(d,b,3); w=accessor(d,b,4)
    bind=np.linalg.inv(accessor(d,b,d['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1))
    for idx,node in enumerate(d['skins'][0]['joints']):
        if 'Hand' in d['nodes'][node]['name']: print(idx,d['nodes'][node]['name'],bind[idx,:3,3])
    fig,axes=plt.subplots(2,3,figsize=(18,10))
    for row,side in enumerate([1,-1]):
        mask=side*p[:,0]>.61
        for ax,(u,v) in zip(axes[row],[(0,1),(0,2),(2,1)]):
            ax.scatter(p[mask,u],p[mask,v],s=.4,c=p[mask,2],cmap='viridis'); ax.set_aspect('equal');ax.grid();ax.set_xlabel('XYZ'[u]);ax.set_ylabel('XYZ'[v])
    fig.tight_layout();fig.savefig(ROOT/'hand_inspect.png',dpi=150)
