"""Extract trusted Fedora RPMs locally. No package install or scriptlet execution."""
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent / '.local-deps/root'
for rpm in sorted((root.parent / 'rpms').glob('*.rpm')):
    # Re-running setup does not overwrite/remove an existing extracted package.
    marker = root.parent / (rpm.name + '.extracted')
    if marker.exists():
        continue
    first = subprocess.Popen(['rpm2cpio', str(rpm)], stdout=subprocess.PIPE)
    result = subprocess.run(['cpio', '-id', '--quiet', '--no-absolute-filenames'],
                            stdin=first.stdout, cwd=root, capture_output=True)
    first.stdout.close()
    if first.wait() or result.returncode:
        raise RuntimeError(result.stderr.decode())
    marker.touch()
for pc in root.glob('usr/**/pkgconfig/*.pc'):
    content = pc.read_text().replace('prefix=/usr', f'prefix={root}/usr')
    content = content.replace('prefix = /usr', f'prefix = {root}/usr')
    pc.write_text(content)
# Development .so links refer to runtime libraries omitted by --resolve when
# already installed. Add missing targets locally, pointing to existing libs.
for link in (root / 'usr/lib64').glob('*.so'):
    if link.is_symlink() and not link.exists():
        target = link.readlink()
        if target.is_absolute():
            continue
        destination = link.parent / target
        system = pathlib.Path('/usr/lib64') / target
        if system.exists() and not destination.is_symlink():
            destination.symlink_to(system)
print('Local Fedora development packages ready:', root)
