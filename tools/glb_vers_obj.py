# Transforme un modèle .glb (Tripo / TRELLIS / Hunyuan…) en .obj + .mtl + texture dans un .zip pour Mixamo
# (Mixamo n'accepte pas le GLB). Pieds posés à 0, hauteur ramenée à H centimètres.
# Usage : python tools/glb_vers_obj.py entree.glb sortie.zip [hauteur_cm]
import json, struct, sys, zipfile, io

src, dst = sys.argv[1], sys.argv[2]
H = float(sys.argv[3]) if len(sys.argv) > 3 else 130.0
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
binStart = 20 + jl + 8
BIN = b[binStart:]
CT = {5126: ('f', 4), 5125: ('I', 4), 5123: ('H', 2), 5121: ('B', 1)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

def acc(i):
    a = j['accessors'][i]
    v = j['bufferViews'][a['bufferView']]
    f, s = CT[a['componentType']]
    n = NC[a['type']]
    off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = v.get('byteStride', s * n)
    out = []
    for k in range(a['count']):
        o = off + k * stride
        out.append(struct.unpack('<' + f * n, BIN[o:o + s * n]))
    return out

prim = j['meshes'][0]['primitives'][0]
P = acc(prim['attributes']['POSITION'])
UV = acc(prim['attributes']['TEXCOORD_0']) if 'TEXCOORD_0' in prim['attributes'] else None
N = acc(prim['attributes']['NORMAL']) if 'NORMAL' in prim['attributes'] else None
I = [x[0] for x in acc(prim['indices'])]
miny = min(p[1] for p in P); maxy = max(p[1] for p in P)
k = H / (maxy - miny)

# texture
mat = j['materials'][prim.get('material', 0)]
img = None
t = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
if t is not None:
    im = j['images'][j['textures'][t['index']]['source']]
    v = j['bufferViews'][im['bufferView']]
    img = BIN[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
ext = 'jpg' if img and img[:2] == b'\xff\xd8' else 'png'

o = io.StringIO()
o.write('mtllib lucas.mtl\no lucas\n')
for p in P: o.write('v %.4f %.4f %.4f\n' % (p[0] * k, (p[1] - miny) * k, p[2] * k))
if UV:
    for u in UV: o.write('vt %.5f %.5f\n' % (u[0], 1 - u[1]))
if N:
    for n in N: o.write('vn %.4f %.4f %.4f\n' % n)
o.write('usemtl peau\n')
for f in range(0, len(I), 3):
    a, c, d = I[f] + 1, I[f + 1] + 1, I[f + 2] + 1
    if UV and N: o.write(f'f {a}/{a}/{a} {c}/{c}/{c} {d}/{d}/{d}\n')
    elif UV: o.write(f'f {a}/{a} {c}/{c} {d}/{d}\n')
    else: o.write(f'f {a} {c} {d}\n')
mtl = f'newmtl peau\nKd 1 1 1\nmap_Kd lucas.{ext}\n'
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('lucas.obj', o.getvalue())
    z.writestr('lucas.mtl', mtl)
    if img: z.writestr('lucas.' + ext, img)
print('ok', len(P), 'sommets', len(I) // 3, 'triangles, texture', ext if img else 'aucune')
