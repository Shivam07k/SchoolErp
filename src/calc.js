export function setupCalcHandlers() {
  $(document).off('change.calc').on('change.calc', '.calc-totals, .calc-taxes', function() {
    calcDiscount.call(this);
    calcRowTotals();
    calcTaxes();
  });
}

function calcDiscount() {
  var q = parseFloat($('#txtQty').val()) || 0;
  var r = parseFloat($('#txtRate').val()) || 0;
  var amt = q * r;
  var dp = parseFloat($('#txtDiscRate').val()) || 0;
  var da = parseFloat($('#txtDiscAmt').val()) || 0;
  var id = $(this).attr('id');
  if (id === 'txtDiscRate') {
    da = amt === 0 ? 0 : (amt * dp / 100);
    $('#txtDiscAmt').val(da.toFixed(2));
  } else if (id === 'txtDiscAmt') {
    dp = amt === 0 ? 0 : (da / amt * 100);
    $('#txtDiscRate').val(dp.toFixed(2));
  } else {
    if (amt === 0) { dp = 0; da = 0; }
    else if (dp !== 0) { da = amt * dp / 100; }
    else if (da !== 0) { dp = da / amt * 100; }
    $('#txtDiscAmt').val(da.toFixed(2));
    $('#txtDiscRate').val(dp.toFixed(2));
  }
  $('#txtTaxableAmt').val((amt - da).toFixed(2));
}

function calcRowTotals() {
  var q = parseFloat($('#txtQty').val()) || 0;
  var r = parseFloat($('#txtRate').val()) || 0;
  var amt = parseFloat($('#txtTaxableAmt').val()) || 0;
  var da = parseFloat($('#txtDiscAmt').val()) || 0;
  if (r === 0 && amt > 0) {
    $('#txtRate').val(((amt + da) / q).toFixed(2));
  } else {
    amt = q * r - da;
  }
  $('#txtTaxableAmt').val(amt.toFixed(2));
  var s = parseFloat($('#txtSGSTamt').val()) || 0;
  var c = parseFloat($('#txtCGSTamt').val()) || 0;
  var i = parseFloat($('#txtIGSTamt').val()) || 0;
  $('#txtInvoiceAmt').val((amt + s + c + i).toFixed(0));
}

function calcTaxes() {
  var amt = parseFloat($('#txtTaxableAmt').val()) || 0;
  $('#txtSGSTamt').val((amt * (parseFloat($('#txtSGSTper').val()) || 0) * 0.01).toFixed(2));
  $('#txtCGSTamt').val((amt * (parseFloat($('#txtCGSTper').val()) || 0) * 0.01).toFixed(2));
  $('#txtIGSTamt').val((amt * (parseFloat($('#txtIGSTper').val()) || 0) * 0.01).toFixed(2));
  var s = parseFloat($('#txtSGSTamt').val()) || 0;
  var c = parseFloat($('#txtCGSTamt').val()) || 0;
  var i = parseFloat($('#txtIGSTamt').val()) || 0;
  $('#txtInvoiceAmt').val((amt + s + c + i).toFixed(0));
}
