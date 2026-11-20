# Nguồn và quyền sử dụng

**DAVIS 2017 — Densely Annotated VIdeo Segmentation**. Nguồn media là video giới thiệu TrainVal công bố trong kho GitHub của nhóm DAVIS. Trang chính thức khai báo giấy phép [Creative Commons Attribution–NonCommercial 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Bản demo phục vụ học tập phi thương mại. Tác giả công trình *The 2017 DAVIS Challenge on Video Object Segmentation* gồm Jordi Pont-Tuset, Federico Perazzi, Sergi Caelles, Pablo Arbeláez, Alexander Sorkine-Hornung và Luc Van Gool.

- [Trang dữ liệu chính thức](https://davischallenge.org/)
- [Công trình nghiên cứu](https://arxiv.org/abs/1704.00675)
- [Video nguồn tại phiên bản đã cố định](https://github.com/davisvideochallenge/davisvideochallenge.github.io/blob/30be16ff9d289f6711328c950a19c6288306ade3/images/DAVIS-2017-TrainVal.mp4)

Video nguồn có SHA-256 `684b51e58c0af28462d6e6c56e65a8057b92577a1f2f9300ee7bbba34322309b`. Bản sao nguyên gốc nằm trong `web/media/davis-trainval.mp4`. Các biến đổi gồm cắt trích đoạn, lấy khung hình giữa đoạn làm ảnh, chuẩn hóa tỉ lệ hiển thị, mã hóa lại và tính metadata. Tiêu đề tiếng Việt, chủ đề và thẻ trong `selections.csv` do dự án biên tập. Số giây là vị trí trong video giới thiệu đã ghép cảnh. Mẫu sử dụng một video giới thiệu từ bộ DAVIS.

Tệp `source-frames.csv.gz` có một dòng cho mỗi frame nguồn. `frame` là chỉ số từ 0, `second` là thời điểm tính theo 20 fps của nguồn, `motion` là chênh lệch màu chuẩn hóa với frame liền trước. Các cột `rgb0`–`rgb11` lần lượt là bốn khoảng cường độ của mỗi kênh R, G, B.

Người dùng giữ quyền đối với tệp họ đăng. Phông chữ Manrope đi kèm giấy phép trong [web/fonts/LICENSE](../web/fonts/LICENSE).
